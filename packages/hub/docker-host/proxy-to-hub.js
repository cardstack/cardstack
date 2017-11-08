const Koa = require('koa');
const proxy = require('koa-proxy');

module.exports = function(hubUrl) {
  let app = new Koa();
  app.use(proxy({
    host: hubUrl
  }));
  return app.callback();
};
