const Koa = require('koa');
const { Registry, Container } = require('@cardstack/di');

const logger = require('@cardstack/plugin-utils/logger');
const log = logger('server');

async function wireItUp(projectDir, encryptionKeys, seedModels, opts = {}) {
  let registry = new Registry();
  registry.register('config:project', {
    path: projectDir,
    allowDevDependencies: opts.allowDevDependencies
  });
  registry.register('config:seed-models', seedModels);
  registry.register('config:encryption-key', encryptionKeys);
  registry.register('config:code-gen', { broccoliConnector: opts.broccoliConnector });

  let container = new Container(registry);

  // in the test suite we want more deterministic control of when
  // indexing happens
  if (!opts.disableAutomaticIndexing) {
    await container.lookup('hub:indexers').update();
    setInterval(() => container.lookup('hub:indexers').update(), 600000);
    container.lookup('hub:writers').addListener('changed', what => container.lookup('hub:indexers').update({ hints: [ what ] }));
  }

  // this registration pattern is how we make broccoli wait for our
  // asynchronous startup stuff before running the first build.
  if (opts.broccoliConnector) {
    opts.broccoliConnector.setSource(container.lookup('hub:code-generators'));
  }

  return container;
}

async function makeServer(projectDir, encryptionKeys, seedModels, opts = {}) {
  let container = await wireItUp(projectDir, encryptionKeys, seedModels, opts);
  let app = new Koa();
  app.use(httpLogging);
  app.use(container.lookup('hub:middleware-stack').middleware());
  return app;
}

async function httpLogging(ctxt, next) {
  log.info('start %s %s', ctxt.request.method, ctxt.request.originalUrl);
  await next();
  log.info('finish %s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
}

exports.wireItUp = wireItUp;
exports.makeServer = makeServer;
