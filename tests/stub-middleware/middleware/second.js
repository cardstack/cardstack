const route = require('koa-better-route');

class SecondMiddleware {
  static create() {
    SecondMiddleware._constructs += 1;
    return new this();
  }
  async teardown() {
    SecondMiddleware._teardowns += 1;
  }

  get category() {
    return 'dos';
  }
  middleware() {
    return route.get('/second', async function(ctxt) {
      ctxt.body = {
        message: 'Second middleware plugin',
        state: JSON.parse(JSON.stringify(ctxt.state)),
      };
    });
  }
}

SecondMiddleware._constructs = 0;
SecondMiddleware._teardowns = 0;

module.exports = SecondMiddleware;
