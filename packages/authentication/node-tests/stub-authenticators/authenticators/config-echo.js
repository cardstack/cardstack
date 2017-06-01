module.exports = class {
  static create() {
    return new this();
  }
  async authenticate(payload, config /*, userSearcher */) {
    return config;
  }
  async exposeConfig(params) {
    return params;
  }
};
