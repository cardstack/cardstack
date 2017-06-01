module.exports = class {
  static create() {
    return new this();
  }
  async authenticate(payload /*, userSearcher */) {
    return payload;
  }
};
