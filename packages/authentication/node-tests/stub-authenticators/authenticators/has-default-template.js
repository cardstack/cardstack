module.exports = class HasDefaultTemplate {
  static create() {
    return new this();
  }
  constructor() {
    this.defaultUserTemplate = '{ "data": { "id": "{{upstreamId}}", "type": "test-users" } }';
  }
  async authenticate(payload /*, userSearcher */) {
    return payload;
  }
};
