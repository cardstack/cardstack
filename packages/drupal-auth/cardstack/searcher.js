const request = require('./request');

module.exports = class DrupalSearcher {
  constructor({ ownToken, permissionRepos }) {
    this.ownToken = ownToken;
    this.permissionRepos = permissionRepos;
  }

  async get(session, branch, type, id, next) {
    if (type === 'drupal-users') {
      return this._getUser(id);
    }
    return next();
  }

  async search(session, branch, query, next) {
    return next();
  }

  async _getUser(login) {
    let options = {
      hostname: 'api.drupal.com',
      port: 443,
      path: `/users/${login}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '@cardstack/drupal-auth',
        Authorization: `token ${this.ownToken}`
      }
    };
    let response = await request(options);
    return this._rewriteUser(response.body);
  }

  _rewriteUser(ghUser) {
    return {
      id: ghUser.login,
      type: 'drupal-users',
      attributes: {
        name: ghUser.name,
        'avatar-url': ghUser.avatar_url,
        email: ghUser.email
      }
    };
  }

};
