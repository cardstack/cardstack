const koaJSONBody = require('koa-json-body');
const Router = require('koa-better-router');
const Error = require('@cardstack/plugin-utils/error');
const https = require('https');

module.exports = function() {
  let router = new Router();

  router.addRoute('OPTIONS', '/', [
    async function(ctxt) {
      ctxt.response.set('Access-Control-Allow-Origin', '*');
      ctxt.response.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
      ctxt.response.set('Access-Control-Allow-Headers', 'Content-Type');
      ctxt.status = 200;
    }
  ]);

  router.addRoute('POST', '/', [
    koaJSONBody({ limit: '1mb' }),
    async function(ctxt) {
      ctxt.response.set('Access-Control-Allow-Origin', '*');

      let body = ctxt.request.body;
      if (!body.authorizationCode) {
        ctxt.response.set('Content-Type', 'application/json');
        ctxt.status = 400;
        ctxt.body = { errors: [ new Error("missing required field 'authorizationCode'", { status: 400 }) ] };
        return;
      }

      let payload = {
        client_id: '2680c97f309a904b41b0',
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: ctxt.request.body.authorizationCode
      };
      if (body.state) {
        payload.state = body.state;
      }

      let data = JSON.stringify(payload);
      let options = {
        hostname: 'github.com',
        port: 443,
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Accept': 'application/json',
          'User-Agent': '@cardstack/oauth2-client'
        }
      };
      let { response, body: responseBody } = await httpsRequest(options, data);
      if (response.statusCode !== 200) {
        ctxt.status = response.statusCode;
        ctxt.body = { errors: [ new Error(responseBody.error), {
          status: response.statusCode,
          upstream: responseBody
        } ] };
        return;
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
        ctxt.status = response.statusCode;
        ctxt.body = { errors: [ new Error(responseBody.error), {
          status: response.statusCode,
          upstream: responseBody
        } ] };
        return;
      }
      ctxt.status = 200;
      ctxt.body = {
        email: userResponse.body.email,
        name: userResponse.body.name,
        id: userResponse.body.id,
        avatarURL: userResponse.body.avatar_url
      };
    }
  ]);

  return router.middleware();
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
