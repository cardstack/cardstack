const route = require('koa-better-route');


module.exports = class IpMiddleware {
  static create() {
    return new this();
  }
  middleware() {
    return route.get('/ip', async function(ctxt) {
      ctxt.body = {
        ip: ctxt.request.ip
      };
    });
  }
};
