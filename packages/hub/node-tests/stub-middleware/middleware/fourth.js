const route = require('koa-better-route');

module.exports = class FirstMiddleware {
  static create() {
    return new this();
  }
  get after() {
    return ['unused-tag'];
  }
  middleware() {
    return route.get('/fourth', async function(ctxt) {
      ctxt.body = {
        message: 'fourth middleware plugin',
        state: JSON.parse(JSON.stringify(ctxt.state))
      };
    });
  }
};
