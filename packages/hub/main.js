const Koa = require('koa');
const Session = require('@cardstack/plugin-utils/session');
const { Registry, Container } = require('@cardstack/di');
// lazy load only in container mode, since they uses node 8 features
let EmberConnection;
let Orchestrator;

const log = require('@cardstack/logger')('cardstack/server');


async function wireItUp(projectDir, encryptionKeys, dataSources, opts = {}) {
  let registry = new Registry();
  registry.register('config:project', {
    path: projectDir
  });
  registry.register('config:data-sources', dataSources);
  registry.register('config:encryption-key', encryptionKeys);
  registry.register('config:public-url', { url: opts.url });

  let seeds;
  if (typeof opts.seeds === 'function') {
    seeds = await opts.seeds();
    registry.register('config:initial-models', seeds);
  } else {
    registry.register('config:initial-models', []);
  }

  let container = new Container(registry);

  if (opts.loadSeeds && seeds) {
    await loadSeeds(container, seeds);
  }

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

async function loadSeeds(container, seedModels, opts) {
  if (!container) { return; }

  log.info("loading seed models");

  let branch = opts && opts.branch || 'master';
  let writers = container.lookup('hub:writers');
  for (let model of seedModels) {
    await writers.create(branch, Session.INTERNAL_PRIVILEGED, model.type, model);
  }
}

async function makeServer(projectDir, encryptionKeys, dataSources, opts = {}) {
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
  let container = await wireItUp(projectDir, encryptionKeys, dataSources, opts);
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
exports.loadSeeds = loadSeeds;
