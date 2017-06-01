module.exports = class HasDefaultTemplate {
  static create() {
    return new this();
  }
  constructor() {
    this.defaultUserTemplate = '{ "id": "{{upstreamId}}", "type": "users" }';
  }
  async authenticate(payload /*, userSearcher */) {
    return payload;
  }
};
