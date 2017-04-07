//const logger = require('heimdalljs-logger');
const koaJSONBody = require('koa-json-body');
const Error = require('@cardstack/plugin-utils/error');
const https = require('https');

module.exports = function() {
  //let log = logger('oauth2-client');
  let bodyParser = koaJSONBody({ limit: '1mb' });

  return async function(ctxt) {
    ctxt.response.set('Access-Control-Allow-Origin', '*');
    if (ctxt.request.method === 'OPTIONS') {
      ctxt.response.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
      ctxt.response.set('Access-Control-Allow-Headers', 'Content-Type');
      ctxt.status = 200;
      return;
    }

    await bodyParser(ctxt, err => {
      if (err) {
        throw err;
      }
    });
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
    await forwardHttpsRequest(ctxt, options, data);
  };
};

function forwardHttpsRequest(ctxt, options, data) {
  return new Promise((resolve,reject) => {
    let ghReq = https.request(options, (ghRes) => {
      ctxt.status = ghRes.statusCode;
      ctxt.response.set('content-type', ghRes.headers['content-type']);
      ctxt.body = ghRes;
      resolve();
    });
    ghReq.on('error', reject);
    ghReq.write(data);
    ghReq.end();
  });
}
