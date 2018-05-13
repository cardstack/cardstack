const Error = require('@cardstack/plugin-utils/error');

module.exports = class {
  static create(...args) {
    return new this(...args);
  }
  constructor(params) {
    this.users = params["users"];
  }

  defaultUserRewriter(user) {
    let output = {
      data: {
        id: user.id,
        type: "mock-users",
        attributes: {
          name: user.name,
          email: user.email,
          "avatar-url": user.picture,
          "email-verified": Boolean(user.verified)
        }
      }
    };
    if (!user.verified) {
      output.data.attributes.message = {
        state: "verify-email",
        id: user.id
      };
      output.data.meta = {
        "partial-session": true
      };
    }
    return output;
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

};
