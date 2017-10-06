const request = require('./lib/request');
const { rewriteExternalUser } = require('@cardstack/authentication');

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
      return this._getUser(id);
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
    return rewriteExternalUser(response.body, this.dataSource);
  }


};
