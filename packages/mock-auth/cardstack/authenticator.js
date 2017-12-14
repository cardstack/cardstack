const Error = require('@cardstack/plugin-utils/error');

class Authenticator {
  static create(...args) {
    return new this(...args);
  }
  constructor(params) {
    let { messengers, users } = params;
    this.messengers = messengers;
    this.users = users;

    this.defaultUserTemplate =  "{ \"data\": { \"id\": \"{{id}}\", \"type\": \"mock-users\", \"attributes\": { \"name\": \"{{name}}\", \"email\":\"{{email}}\", \"avatar-url\":\"{{picture}}\" }}}";
  }

  async authenticate(payload /*, userSearcher */) {
    if (!payload.authorizationCode) {
      throw new Error("missing required field 'authorizationCode'", {
        status: 400
      });
    }

    let mockUser = this.users[payload.authorizationCode];

    if (mockUser) {
      mockUser.id = payload.authorizationCode;
      return mockUser;
    }

    throw new Error("User doesn't exist", {
      status: 401,
      description: `A mock user with the id of "${payload.authorizationCode}" does not exist`
    });
  }

  exposeConfig() {
    return { mockEnabled: true };
  }

}

module.exports = Authenticator;
