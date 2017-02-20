const Koa = require('koa');
const app = new Koa();
app.use(require('@cardstack/oauth2-server')());
app.use(require('@cardstack/server/jsonapi')());
app.listen(3000);
