const Koa = require('koa');
const { Registry, Container } = require('@cardstack/di');
// lazy load only in container mode, since they uses node 8 features
let EmberConnection;
let Orchestrator;

const log = require('@cardstack/logger')('cardstack/server');
const path = require('path');
const { spawn } = require('child_process');


async function wireItUp(projectDir, encryptionKeys, seedModels, opts = {}) {
  let registry = new Registry();
  registry.register('config:project', {
    path: projectDir
  });
  registry.register('config:seed-models', seedModels);
  registry.register('config:encryption-key', encryptionKeys);
  registry.register('config:public-url', { url: opts.url });

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

function prepareSpawnHub(packageName, configPath, environment, port, explicitURL) {
  let setEnvVars = Object.create(null);
  if (!process.env.CARDSTACK_SESSIONS_KEY) {
    const crypto = require('crypto');
    let key = crypto.randomBytes(32);
    setEnvVars.CARDSTACK_SESSIONS_KEY = key.toString('base64');
  }
  if (!process.env.DEBUG && environment === 'development') {
    setEnvVars.DEBUG = 'cardstack/*';
  }
  if (!process.env.DEBUG_COLORS) {
    setEnvVars.DEBUG_COLORS='yes';
  }
  if (!process.env.ELASTICSEARCH_PREFIX) {
    setEnvVars.ELASTICSEARCH_PREFIX = packageName.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z0-9]/g, '_') + '_' + environment;
  }

  let seedDir = path.join(path.dirname(configPath),
                          '..', 'cardstack', 'seeds', environment);

  let bin = path.join(__dirname, 'bin', 'cardstack-hub.js');
  let url = explicitURL || `http://localhost:${port}`;
  return { setEnvVars, bin, args: [seedDir, '--port', port, '--url', url] };
}

async function spawnHub(packageName, configPath, environment, port, url) {
  let { setEnvVars, bin, args } = prepareSpawnHub(packageName, configPath, environment, port, url);

  for (let [key, value] of Object.entries(setEnvVars)) {
    process.env[key] = value;
  }

  let proc = spawn(bin, args, { stdio: [0, 1, 2, 'ipc']  });
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
  return `http://localhost:${port}`;
}

exports.wireItUp = wireItUp;
exports.makeServer = makeServer;
exports.spawnHub = spawnHub;
exports.prepareSpawnHub = prepareSpawnHub;
