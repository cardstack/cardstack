module.exports = class WrapMiddleware {
  static create() {
    return new this();
  }
  get before() {
    return ['unused-tag'];
  }
  middleware() {
    return async function(ctxt, next) {
      ctxt.state.thirdRan = true;
      await next();
      ctxt.state.thirdRan = false;
    };
  }
};
