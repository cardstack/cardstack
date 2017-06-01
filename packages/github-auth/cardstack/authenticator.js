const Error = require('@cardstack/plugin-utils/error');
const request = require('./lib/request');

module.exports = class {
  async authenticate(payload, params /*, userSearcher */) {
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

    let { response, body: responseBody } = await request(options, data);
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
        'User-Agent': '@cardstack/github-auth',
        Authorization: `token ${responseBody.access_token}`
      }
    };

    let userResponse = await request(options);
    if (userResponse.response.statusCode !== 200) {
      throw new Error(responseBody.error, { status: response.statusCode });
    }
    return {
      user: userResponse.body
    };
  }

  exposeConfig(params) {
    return {
      clientId: params['client-id']
    };
  }

  constructor() {
    this.defaultUserTemplate =  "{ \"id\": \"{{login}}\", \"type\": \"github-users\", \"attributes\": { \"name\": \"{{name}}\", \"email\":\"{{email}}\", \"avatar-url\":\"{{avatar_url}}\" }}";
  }
};
