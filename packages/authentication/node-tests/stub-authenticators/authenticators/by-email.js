const Error = require('@cardstack/plugin-utils/error');
module.exports = class {
  static create() {
    return new this();
  }
  async authenticate({ email }, config, userSearcher) {
    if (email == null) {
      throw new Error("email is required", { status: 400 });
    }
    let { data } = await userSearcher.search({
      filter: { email: { exact: email } },
      page: { size: 1 }
    });
    if (data.length > 0) {
      return {
        data: data[0],
        meta: {
          preloaded: true
        }
      };
    }
  }
};
