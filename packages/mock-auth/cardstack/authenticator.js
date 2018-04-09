const Error = require('@cardstack/plugin-utils/error');

module.exports = class {
  static create(...args) {
    return new this(...args);
  }
  constructor(params) {
    this.users = params["users"];

    this.defaultUserTemplate = `{
      "data": {
        "id": "{{id}}",
        "type": "mock-users",
        "attributes": {
          "name": "{{name}}",
          "email":"{{email}}",
          "avatar-url":"{{{picture}}}",
          "email-verified":{{#if verified}}true{{else}}false{{/if}}
          {{#unless verified}}
            ,
            "message": {
              "state": "verify-email",
              "id": "{{id}}"
            }
          {{/unless}}
        }
      }
      {{#unless verified}}
        ,
        "meta": {
          "partial-session": true
        }
      {{/unless}}
    }`;
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
