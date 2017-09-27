module.exports = class HasDefaultTemplate {
  static create() {
    return new this();
  }
  constructor() {
    this.defaultUserTemplate = '{ "data": { "id": "{{upstreamId}}", "type": "users" } }';
  }
  async authenticate(payload /*, userSearcher */) {
    return payload;
  }
};
