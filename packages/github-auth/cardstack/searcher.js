const request = require('./lib/request');

module.exports = class GitHubSearcher {
  constructor({ ownToken, permissionRepos }) {
    this.ownToken = ownToken;
    this.permissionRepos = permissionRepos;
  }

  async get(branch, type, id, next) {
    if (type === 'github-users') {
      return { data: this._getUser(id) };
    }
    return next();
  }

  async search(branch, query, next) {
    return next();
  }

  async _getUser(login) {
    let options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/users/${login}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': '@cardstack/github-auth',
        Authorization: `token ${this.ownToken}`
      }
    };
    let response = await request(options);
    return this._rewriteUser(response.body);
  }

  _rewriteUser(ghUser) {
    return {
      id: ghUser.login,
      type: 'github-users',
      attributes: {
        name: ghUser.name,
        'avatar-url': ghUser.avatar_url,
        email: ghUser.email
      }
    };
  }

};
