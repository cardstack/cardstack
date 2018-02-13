const { rewriteExternalUser } = require('@cardstack/authentication');

module.exports = class MockSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor(opts) {
    let { dataSource, users } = opts;
    this.users = users;
    this.dataSource = dataSource;
  }

  async get(session, branch, type, id, next) {
    if (type === 'mock-users') {
      return this._getUser(id);
    }
    return next();
  }

  async search(branch, query, next) {
    return next();
  }

  async _getUser(login) {
    let mockUser = this.users && this.users[login];
    if (mockUser) {
      mockUser.id = login;
      return rewriteExternalUser(mockUser, this.dataSource);
    }
  }


};
