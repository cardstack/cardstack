const route = require('koa-better-route');

module.exports = class FirstMiddleware {
  static create() {
    return new this();
  }
  get category() {
    return 'uno';
  }
  middleware() {
    return route.get('/first', async function(ctxt) {
      ctxt.body = {
        message: 'First middleware plugin',
        state: JSON.parse(JSON.stringify(ctxt.state))
      };
    });
  }
};
