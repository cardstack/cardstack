const Koa = require('koa');
const proxy = require('koa-proxy');

module.exports = function() {
  let app = new Koa();
  app.use(proxy({
    host: 'http://localhost:3000'
  }));
  return app.callback();
};
