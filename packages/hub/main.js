const Koa = require('koa');
const Searcher = require('@cardstack/elasticsearch/searcher');
const Writers = require('@cardstack/hub/writers');
const SchemaCache = require('@cardstack/hub/schema-cache');
const Indexers = require('@cardstack/hub/indexers');
const Authentication = require('@cardstack/hub/authentication');

const logger = require('heimdalljs-logger');
const log = logger('server');

async function wireItUp(encryptionKeys, seedModels) {
  let schemaCache = new SchemaCache(seedModels);
  let indexers = new Indexers(schemaCache);
  setInterval(() => indexers.update(), 1000);
  let writers = new Writers(schemaCache);
  writers.addListener('changed', what => indexers.update({ hints: [ what ] }));
  await indexers.update();
  let searcher = new Searcher(schemaCache);
  let controllingSchema = await schemaCache.schemaForControllingBranch();
  let authentication = new Authentication(encryptionKeys, searcher, writers, controllingSchema.plugins);
  return { searcher, writers, authentication };
}

async function makeServer(encryptionKeys, seedModels) {
  let { searcher, writers, authentication } = await wireItUp(encryptionKeys, seedModels);
  let app = new Koa();
  app.use(httpLogging);
  app.use(authentication.middleware());
  app.use(require('@cardstack/jsonapi/middleware')(searcher, writers));
  return app;
}

async function httpLogging(ctxt, next) {
  await next();
  log.info('%s %s %s', ctxt.request.method, ctxt.request.url, ctxt.response.status);
}

exports.makeServer = makeServer;
