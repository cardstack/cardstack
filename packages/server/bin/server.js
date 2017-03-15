const Koa = require('koa');
const app = new Koa();
const Searcher = require('@cardstack/elasticsearch/searcher');
const Writers = require('@cardstack/server/writers');
const SchemaCache = require('@cardstack/server/schema-cache');

let schemaCache = new SchemaCache();

app.use(require('@cardstack/jsonapi/middleware')(new Searcher(schemaCache), new Writers(schemaCache)));
app.listen(3000);
