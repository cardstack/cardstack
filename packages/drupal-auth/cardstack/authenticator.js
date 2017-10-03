const Error = require('@cardstack/plugin-utils/error');
const request = require('superagent');
const log = require('@cardstack/plugin-utils/logger')('drupal-auth');

module.exports = class {
  static create() {
    return new this;
  }
  async authenticate(payload, params, userSearcher) {
    if (!payload.authorizationCode) {
      throw new Error("missing required field 'authorizationCode'", {
        status: 400
      });
    }

    let payloadToDrupal = {
      client_id: params['client-id'],
      client_secret: params['client-secret'],
      code: decodeURIComponent(payload.authorizationCode),
      grant_type: 'authorization_code',
      redirect_uri: payload.redirectUri
    };


    if (payload.state) {
      payloadToDrupal.state = payload.state;
    }

    try {
      let response = await request
          .post(params.url + '/oauth/token')
          .type('form')
          .set('Accept', 'application/json')
          .set('User-Agent', '@cardstack/drupal-auth')
          .send(payloadToDrupal);
      log.debug("POST to token endpoint returned %s", response.status);
      let accessToken = response.body.access_token;
      response = await request.get(params.url + '/oauth/debug?_format=json')
        .set('Authorization', `Bearer ${accessToken}`);
      log.debug("GET from token endpoint returned %s", response.status);

      let type = params.userType || 'users';

      if (params.userIdField) {
        log.debug("Searching for %s=%s", params.userIdField, response.body.id);
        let { data: models } = await userSearcher.search({
          filter: {
            type,
            [params.userIdField]: { exact: response.body.id }
          },
          page: { limit: 1 }
        });
        if (models.length > 0) {
          log.debug("Found user %s", models[0].id);
          return { preloadedUser: models[0] };
        } else {
          log.debug("No such user");
        }
      } else {
        return { user: { id: response.body.id, type }};
      }

    } catch(err) {
      if (err.status) {
        log.debug("Drupal replied with %s: %s", err.status, JSON.stringify(err.response.body, null, 2));
      } else {
        log.debug(err);
      }
    }
  }

  exposeConfig(params) {
    return {
      clientId: params['client-id'],
      drupalUrl: params.url
    };
  }

  constructor() {
    this.defaultUserTemplate =  "{ \"id\": \"{{login}}\", \"type\": \"drupal-users\", \"attributes\": { \"name\": \"{{name}}\", \"email\":\"{{email}}\", \"avatar-url\":\"{{avatar_url}}\" }}";
  }
};
