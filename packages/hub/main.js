const Koa = require('koa');
const { Registry, Container } = require('@cardstack/di');

const logger = require('heimdalljs-logger');
const log = logger('server');

async function wireItUp(projectDir, encryptionKeys, seedModels, isTesting=false) {
  let registry = new Registry();

  registry.register('config:project', {
    path: projectDir,
    isTesting
  });
  registry.register('config:seed-models', seedModels);
  registry.register('config:encryption-key', encryptionKeys);

  let container = new Container(registry);


  // in the test suite we want more deterministic control of when
  // indexing happens
  if (!isTesting) {
    await container.lookup('hub:indexers').update();
    setInterval(() => container.lookup('hub:indexers').update(), 600000);
    container.lookup('hub:writers').addListener('changed', what => container.lookup('hub:indexers').update({ hints: [ what ] }));
  }

  return container;
}

async function makeServer(projectDir, encryptionKeys, seedModels) {
  let container = await wireItUp(projectDir, encryptionKeys, seedModels);
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
