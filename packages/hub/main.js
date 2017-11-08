const Koa = require('koa');
const { Registry, Container } = require('@cardstack/di');
// lazy load only in container mode, since they uses node 8 features
let EmberConnection;
let Orchestrator;

const logger = require('@cardstack/plugin-utils/logger');
const log = logger('server');
const path = require('path');
const { spawn } = require('child_process');


async function wireItUp(projectDir, encryptionKeys, seedModels, opts = {}) {
  let registry = new Registry();
  registry.register('config:project', {
    path: projectDir,
    allowDevDependencies: opts.allowDevDependencies
  });
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

async function spawnHub(packageName, configPath, environment) {
  if (!process.env.CARDSTACK_SESSIONS_KEY) {
    const crypto = require('crypto');
    let key = crypto.randomBytes(32);
    process.env.CARDSTACK_SESSIONS_KEY = key.toString('base64');
  }
  if (!process.env.DEBUG) {
    process.env.DEBUG = 'cardstack/*';
  }
  if (!process.env.DEBUG_COLORS) {
    process.env.DEBUG_COLORS='yes';
  }
  if (!process.env.ELASTICSEARCH_PREFIX) {
    process.env.ELASTICSEARCH_PREFIX = packageName.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + environment;
  }

  // I think this flag needs to get refactored away, it's always the
  // right behavior to have it turned on, there's no time that your
  // app will be installed without the devDeps present. So the
  // distinction really only matters for addons. And even when
  // inside an addon running the dummy app, devDeps should always be
  // included.
  let flags = ['--allow-dev-dependencies'];

  let seedDir = path.join(path.dirname(configPath),
                          '..', 'cardstack', 'seeds', environment);

  let proc = spawn('npx', ['cardstack-hub', ...flags, seedDir], { stdio: [0, 1, 2, 'ipc']  });
  await new Promise((resolve, reject) => {
    // by convention the hub will send a hello message if it sees we
    // are supervising it over IPC. If we get an error or exit before
    // that, it's a failure to spawn the hub.
    proc.on('message', message => {
      if (message === 'hub hello') {
        resolve();
      }
    });
    proc.on('error', reject);
    proc.on('exit', reject);
  });
  return 'http://localhost:3000';
}

exports.wireItUp = wireItUp;
exports.makeServer = makeServer;
exports.spawnHub = spawnHub;
