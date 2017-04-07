const Koa = require('koa');
let app = new Koa();
app.use(require('../middleware')());
app.listen(3001);
console.log("listening on 3001");
