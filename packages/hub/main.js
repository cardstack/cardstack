const Koa = require('koa');
const Searcher = require('@cardstack/elasticsearch/searcher');
const Writers = require('@cardstack/hub/writers');
const SchemaCache = require('@cardstack/hub/schema-cache');
const Indexers = require('@cardstack/hub/indexers');
const Encryptor = require('@cardstack/hub/encryptor');
const Authentication = require('@cardstack/hub/authentication');
const { Registry, Container } = require('@cardstack/di');

const logger = require('heimdalljs-logger');
const log = logger('server');

async function wireItUp(encryptionKeys, seedModels, withAsyncWatchers=true) {
  let registry = new Registry();

  registry.register('config:seed-models', seedModels, { instantiate: false });
  registry.register('config:encryption-key', encryptionKeys, { instantiate: false });

  registry.register('schema-cache:main', SchemaCache);
  registry.register('writers:main', Writers);
  registry.register('searcher:main', Searcher);
  registry.register('indexers:main', Indexers);
  registry.register('encryptor:main', Encryptor);
  registry.register('authentication:main', Authentication);

  let container = new Container(registry);

  if (withAsyncWatchers) {
    setInterval(() => container.lookup('indexers:main').update(), 1000);
    container.lookup('writers:main').addListener('changed', what => container.lookup('indexers:main').update({ hints: [ what ] }));
  }

  return container;
}

async function makeServer(encryptionKeys, seedModels) {
  let container = await wireItUp(encryptionKeys, seedModels);
  let app = new Koa();
  app.use(httpLogging);
  app.use(container.lookup('authentication:main').middleware());
  app.use(require('@cardstack/jsonapi/middleware')(container.lookup('searcher:main'), container.lookup('writers:main')));
  return app;
}

async function httpLogging(ctxt, next) {
  await next();
  log.info('%s %s %s', ctxt.request.method, ctxt.request.url, ctxt.response.status);
}

exports.wireItUp = wireItUp;
exports.makeServer = makeServer;
