module.exports = class HasDefaultTemplate {
  static create() {
    return new this();
  }
  defaultUserRewriter(user) {
    return {
      data: {
        id: user.upstreamId,
        type: "test-users"
      }
    };
  }
  async authenticate(payload /*, userSearcher */) {
    return payload;
  }
};
