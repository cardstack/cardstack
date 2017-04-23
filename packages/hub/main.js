const Koa = require('koa');
const { Registry, Container } = require('@cardstack/di');

const logger = require('heimdalljs-logger');
const log = logger('server');

async function wireItUp(encryptionKeys, seedModels, withAsyncWatchers=true) {
  let registry = new Registry();

  registry.register('config:seed-models', seedModels, { instantiate: false });
  registry.register('config:encryption-key', encryptionKeys, { instantiate: false });

  let container = new Container(registry);

  // this is generally only false in the test suite, where we want
  // more deterministic control of when indexing happens.
  if (withAsyncWatchers) {
    await container.lookup('hub:indexers').update();
    setInterval(() => container.lookup('hub:indexers').update(), 600000);
    container.lookup('hub:writers').addListener('changed', what => container.lookup('hub:indexers').update({ hints: [ what ] }));
  }

  return container;
}

async function makeServer(encryptionKeys, seedModels) {
  let container = await wireItUp(encryptionKeys, seedModels);
  let app = new Koa();
  app.use(httpLogging);
  app.use(container.lookup('hub:middleware-stack').middleware());
  return app;
}

async function httpLogging(ctxt, next) {
  await next();
  log.info('%s %s %s', ctxt.request.method, ctxt.request.url, ctxt.response.status);
}

exports.wireItUp = wireItUp;
exports.makeServer = makeServer;
