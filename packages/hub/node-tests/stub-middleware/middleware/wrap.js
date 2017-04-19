module.exports = class WrapMiddleware {
  static create() {
    return new this();
  }
  get before() {
    return ['@cardstack/hub/node-tests/stub-middleware::first'];
  }
  get after() {
    return ['@cardstack/hub/node-tests/stub-middleware::second'];
  }
  middleware() {
    return async function(ctxt, next) {
      ctxt.state.wrapped = true;
      await next();
      ctxt.state.wrapped = false;
    };
  }
};
