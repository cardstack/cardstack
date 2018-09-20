const request = require('./lib/request');
const { get } = require('lodash');

module.exports = class GitHubSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor(opts) {
    let { token, dataSource } = opts;
    this.token = token;
    this.dataSource = dataSource;
    this.cacheMaxAge = opts['cache-max-age'];
  }

  async get(session, branch, type, id, next) {
    let result = await await next();
    if (result) {
      return result;
    }

    if (type === 'github-users') {
      return this._getUser(id);
    }
  }

  async search(session, branch, query, next) {
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
    let user = await this.dataSource.rewriteExternalUser(response.body);

    let maxAge = this.cacheMaxAge;
    if (maxAge == null) {
      let cacheControl = get(response, 'response.headers.cache-control') ||
                         get(response, 'response.headers.Cache-Control');
      if (cacheControl) {
        let match = /max-age=(\d+)/.exec(cacheControl);
        if (match && match.length > 1) {
          maxAge = parseInt(match[1], 10);
        }
      }
    }

    if (maxAge) {
      user.meta = user.meta || {};
      user.meta['cardstack-cache-control'] = { 'max-age': maxAge };
    }

    return user;
  }
};
