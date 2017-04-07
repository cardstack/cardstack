const Koa = require('koa');
const mount = require('koa-mount');

let app = new Koa();
app.use(mount('/oauth2', require('../middleware')()));
app.listen(3001);
console.log("listening on 3001");
