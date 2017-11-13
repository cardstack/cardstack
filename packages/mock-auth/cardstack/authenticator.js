const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  messengers: 'hub:messengers'
},

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

      // TODO also remove di in package.json & cleanup yarn.lock when you remove this silly test
      // silly test
      setTimeout(() => {
        this.messengers.send('user-notification', {
          userId: mockUser.id,
          body: 'yo matey'
        });
        // let messenger = await this.messengers.getMessenger('user-notification');
        // let sentMessages = await messenger.getSentMessages();
        // console.log("=============> SENT MESSAGES", JSON.stringify(sentMessages, null, 2));
      }, 5000);

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

});
