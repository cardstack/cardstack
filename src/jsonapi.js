const Koa = require('koa');

module.exports = function makeApp() {
  let app = new Koa();

  app.use(async (ctx) => {
    ctx.body = {
      data: [
        {
          id: 0,
          type: 'fields',
          attributes: {
            name: 'string'
          }
        }
      ]
    };
  });

  return app;
};
