const request = require('./lib/request');
const { get, groupBy } = require('lodash');

const githubPermissions = {
  admin: ['read', 'write', 'admin'],
  write: ['read', 'write'],
  read:  ['read']
};

module.exports = class GitHubSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor(opts) {
    let { token, dataSource, permissions } = opts;
    this.token = token;
    this.dataSource = dataSource;
    this.permissions = permissions;
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
    let userData = response.body;
    if (!userData) { return; }

    userData.permissions = await this._getPermissions(userData.login);
    let user = await this.dataSource.rewriteExternalUser(userData);

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

  async _getPermissions(username) {
    if (!username || !this.permissions || !this.permissions.length) { return; }

    let permissions = [];
    let repos = groupBy(this.permissions, 'repo');

    for (let repo of Object.keys(repos)) {
      let options = {
        hostname: 'api.github.com',
        port: 443,
        path: `/repos/${repo}/collaborators/${username}/permission`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': '@cardstack/github-auth',
          Authorization: `token ${this.token}`
        }
      };
      let response = await request(options);
      let userPermission = get(response, 'body.permission');
      if (!userPermission) { continue; }

      let userExpandedPermissions = githubPermissions[userPermission];
      if (!userExpandedPermissions) { continue; }

      for (let repoPermission of repos[repo]) {
        if (userExpandedPermissions.includes(repoPermission.permission)) {
          permissions.push(repoPermission);
        }
      }
    }

    return permissions;
  }
};
