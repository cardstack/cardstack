const Error = require('@cardstack/plugin-utils/error');
module.exports = class {
  static create() {
    return new this();
  }
  async authenticate({ email }, config, userSearcher) {
    if (email == null) {
      throw new Error("email is required", { status: 400 });
    }
    let { models } = await userSearcher.search({ filter: { email: { exact: email } } });
    if (models.length > 0) {
      return {
        preloadedUser: models[0]
      };
    }
  }
};
