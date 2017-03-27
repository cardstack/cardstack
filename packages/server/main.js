const Koa = require('koa');
const Searcher = require('@cardstack/elasticsearch/searcher');
const Writers = require('@cardstack/server/writers');
const SchemaCache = require('@cardstack/server/schema-cache');
const Indexers = require('@cardstack/server/indexers');
const logger = require('heimdalljs-logger');
const log = logger('server');

async function wireItUp(seedModels) {
  let schemaCache = new SchemaCache(seedModels);
  let indexers = new Indexers(schemaCache);
  setInterval(() => indexers.update(), 1000);
  let writers = new Writers(schemaCache);
  writers.addListener('changed', what => indexers.update({ hints: [ what ] }));
  await indexers.update();
  let searcher = new Searcher(schemaCache);
  return { searcher, writers };
}

async function makeServer(seedModels) {
  let { searcher, writers } = await wireItUp(seedModels);
  let app = new Koa();
  app.use(httpLogging);
  app.use(require('@cardstack/jsonapi/middleware')(searcher, writers));
  return app;
}

async function httpLogging(ctxt, next) {
  await next();
  log.info('%s %s %s', ctxt.request.method, ctxt.request.url, ctxt.response.status);
}

exports.makeServer = makeServer;
