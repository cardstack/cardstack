const request = require('./lib/request');

module.exports = class GitHubSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ token, dataSource }) {
    this.token = token;
    this.dataSource = dataSource;
  }

  async get(branch, type, id, next) {
    if (type === 'github-users') {
      return { data: await this._getUser(id) };
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
        Authorization: `token ${this.token}`
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
