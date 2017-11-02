const Koa = require('koa');
const { Registry, Container } = require('@cardstack/di');
// lazy load only in container mode, since they uses node 8 features
let EmberConnection;
let Orchestrator;

const logger = require('@cardstack/plugin-utils/logger');
const log = logger('server');

async function wireItUp(projectDir, encryptionKeys, seedModels, opts = {}) {
  let registry = new Registry();
  registry.register('config:project', {
    path: projectDir,
    allowDevDependencies: opts.allowDevDependencies
  });
  if (opts.emberConfigEnv) {
    registry.register('config:ember', opts.emberConfigEnv);
  }
  registry.register('config:seed-models', seedModels);
  registry.register('config:encryption-key', encryptionKeys);

  let container = new Container(registry);

  // in the test suite we want more deterministic control of when
  // indexing happens
  if (!opts.disableAutomaticIndexing) {
    await container.lookup('hub:indexers').update();
    setInterval(() => container.lookup('hub:indexers').update(), 600000);
  }

  // this registration pattern is how we make broccoli wait for our
  // asynchronous startup stuff before running the first build.
  if (opts.broccoliConnector) {
    opts.broccoliConnector.setSource(container.lookup('hub:code-generators'));
  }

  return container;
}

async function makeServer(projectDir, encryptionKeys, seedModels, opts = {}) {
  let readyResolver;
  if (opts.containerized) {
    log.debug('Running in container mode');
    // lazy loading
    Orchestrator = Orchestrator || require('./docker-container/orchestrator');
    EmberConnection = EmberConnection || require('./docker-container/ember-connection');

    let orchestrator = new Orchestrator(opts.leaveServicesRunning);
    orchestrator.start();

    let readyPromise = new Promise(function(r) { readyResolver = r; });

    // Eventually we'll pass a connection instance into the hub, for triggering rebuilds.
    // For now, it just has the side effect of shutting the hub down properly when it's time.
    new EmberConnection({
      orchestrator,
      ready: readyPromise,
      heartbeat: opts.heartbeat
    });

    await orchestrator.ready;
  }

  log.info('Starting main hub server');
  let container = await wireItUp(projectDir, encryptionKeys, seedModels, opts);
  let app = new Koa();
  app.use(httpLogging);
  app.use(container.lookup('hub:middleware-stack').middleware());
  log.info('Main hub initialized');
  if (opts.containerized) { readyResolver(); }
  return app;
}

async function httpLogging(ctxt, next) {
  log.info('start %s %s', ctxt.request.method, ctxt.request.originalUrl);
  await next();
  log.info('finish %s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
}

exports.wireItUp = wireItUp;
exports.makeServer = makeServer;
