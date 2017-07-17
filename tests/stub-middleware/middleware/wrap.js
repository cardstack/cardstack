module.exports = class WrapMiddleware {
  static create() {
    return new this();
  }
  get before() {
    return ['uno'];
  }
  get after() {
    return ['dos', 'unused-tag'];
  }
  middleware() {
    return async function(ctxt, next) {
      ctxt.state.wrapped = true;
      await next();
      ctxt.state.wrapped = false;
    };
  }
};
