module.exports = class MockSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor(opts) {
    let { dataSource, users, mockedTypes } = opts;
    this.users = users;
    this.dataSource = dataSource;
    this.mockedTypes = ['mock-users'].concat(mockedTypes || []);
  }

  async get(session, branch, type, id, next) {
    if (this.mockedTypes.includes(type)) {
      return this._getUser(id);
    }
    return next();
  }

  async search(session, branch, query, next) {
    return next();
  }

  async _getUser(login) {
    let mockUser = this.users && this.users[login];
    if (mockUser) {
      mockUser.id = login;
      return await this.dataSource.rewriteExternalUser(mockUser);
    }
  }
};
