const route = require('koa-better-route');

module.exports = class SecondMiddleware {
  static create() {
    return new this();
  }
  middleware() {
    return route.get('/second', async function(ctxt) {
      ctxt.body = {
        message: 'Second middleware plugin',
        state: JSON.parse(JSON.stringify(ctxt.state))
      };
    });
  }
};
