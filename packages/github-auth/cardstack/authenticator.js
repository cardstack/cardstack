const Error = require('@cardstack/plugin-utils/error');
const https = require('https');

exports.authenticate = async function(payload, params /*, userSearcher */) {
  if (!payload.authorizationCode) {
    throw new Error("missing required field 'authorizationCode'", {
      status: 400
    });
  }

  let payloadToGitHub = {
    client_id: params['client-id'],
    client_secret: params['client-secret'],
    code: payload.authorizationCode
  };
  if (payload.state) {
    payloadToGitHub.state = payload.state;
  }

  let data = JSON.stringify(payloadToGitHub);
  let options = {
    hostname: 'github.com',
    port: 443,
    path: '/login/oauth/access_token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Accept': 'application/json',
      'User-Agent': '@cardstack/github-auth'
    }
  };

  let { response, body: responseBody } = await httpsRequest(options, data);
  if (response.statusCode !== 200) {
    throw new Error(responseBody.error, {
      status: response.statusCode
    });
  }

  options = {
    hostname: 'api.github.com',
    port: 443,
    path: '/user',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': '@cardstack/oauth2-client',
      Authorization: `token ${responseBody.access_token}`
    }
  };

  let userResponse = await httpsRequest(options);
  if (userResponse.response.statusCode !== 200) {
    throw new Error(responseBody.error, { status: response.statusCode });
  }
  return {
    user: userResponse.body
  };
};

function httpsRequest(options, data) {
  return new Promise((resolve,reject) => {
    let ghReq = https.request(options, (ghRes) => {
      let body = '';
      ghRes.setEncoding('utf8');
      ghRes.on('data', chunk => body += chunk);
      ghRes.on('end', () => {
        resolve({ response: ghRes, body: JSON.parse(body) });
      });
    });
    ghReq.on('error', reject);
    if (data) {
      ghReq.write(data);
    }
    ghReq.end();
  });
}

exports.exposeConfig = function(params) {
  return {
    clientId: params['client-id']
  };
};
