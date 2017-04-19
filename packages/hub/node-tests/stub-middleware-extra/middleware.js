const route = require('koa-better-route');

module.exports = class FirstMiddleware {
  static create() {
    return new this();
  }
  middleware() {
    return route.get('/extra', async function(ctxt) {
      ctxt.body = {
        message: 'Extra middleware plugin'
      };
    });
  }
};
