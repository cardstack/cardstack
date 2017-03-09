const Koa = require('koa');
const app = new Koa();
const Searcher = require('@cardstack/elasticsearch/searcher');
const SchemaCache = require('@cardstack/server/schema-cache');

let schemaCache = new SchemaCache();

app.use(require('@cardstack/oauth2-server')());
app.use(require('@cardstack/jsonapi/middleware')(new Searcher(schemaCache), schemaCache));
app.listen(3000);
