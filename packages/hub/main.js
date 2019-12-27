const Koa = require('koa');
const Session = require('@cardstack/plugin-utils/session');
const { Registry, Container } = require('@cardstack/di');
const postgresConfig = require('@cardstack/plugin-utils/postgres-config');
const { get, partition } = require('lodash');
const { writeSnapshot } = require('heapdump');
// lazy load only in container mode, since they uses node 8 features
let EmberConnection;
let Orchestrator;

const log = require('@cardstack/logger')('cardstack/server');

async function wireItUp(projectDir, encryptionKeys, dataSources, opts = {}) {
  let registry = new Registry();
  registry.register('config:project', {
    path: projectDir,
  });
  registry.register('config:environment', { name: opts.environment });
  registry.register('config:data-sources', dataSources);
  registry.register('config:encryption-key', encryptionKeys);
  registry.register('config:public-url', { url: opts.url });
  registry.register('config:ci-session', { id: opts.ciSessionId });
  registry.register(
    'config:pg-boss',
    postgresConfig(
      Object.assign(
        {
          database: process.env.PG_BOSS_DATABASE || `pgboss_${opts.environment}`,
          host: process.env.PG_BOSS_HOST,
          user: process.env.PG_BOSS_USER,
          port: process.env.PG_BOSS_PORT,
          password: process.env.PG_BOSS_PASSWORD,
        },
        opts.pgBossConfig
      )
    )
  );

  if (typeof opts.seeds === 'function') {
    registry.register('config:initial-models', opts.seeds);
  } else {
    registry.register('config:initial-models', () => []);
  }

  if (process.env.PROFILE_MEMORY_SEC) {
    setInterval(
      () => writeSnapshot((err, filename) => log.info(`heap dump written to ${filename}`)),
      process.env.PROFILE_MEMORY_SEC * 1000
    );
  }

  let container = new Container(registry);

  // in the test suite we want more deterministic control of when
  // indexing happens
  if (!opts.disableAutomaticIndexing) {
    await container.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`).ensureDatabaseSetup();
    startIndexing(opts.environment, container); // dont await boot-time indexing, invalidation logic has our back
  }

  // this registration pattern is how we make broccoli wait for our
  // asynchronous startup stuff before running the first build.
  if (opts.broccoliConnector) {
    opts.broccoliConnector.setSource(container.lookup('hub:code-generators'));
  }

  return container;
}

async function startIndexing(environment, container) {
  // some datasources are dependent upon a sync at boot for index of pristine system
  await container.lookup('hub:indexers').update({
    dontWaitForJob: environment === 'production',
  });

  let ephemeralStorage = await container.lookup(`plugin-services:${require.resolve('@cardstack/ephemeral/service')}`);
  if (environment !== 'production' && ephemeralStorage) {
    let searchers = await container.lookup(`hub:searchers`);
    let models = await (await container.lookup('config:initial-models'))();
    let [cards, nonCardModels] = partition(models, i => get(i, 'data.type') === 'cards');

    try {
      await ephemeralStorage.validateModels(nonCardModels, async (type, id) => {
        let result;
        try {
          result = await searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', type, id);
        } catch (err) {
          if (err.status !== 404) {
            throw err;
          }
        }

        if (result && result.data) {
          return result.data;
        }
      });
    } catch (err) {
      log.error(`Shutting down hub due to invalid model(s): ${err.message}`);
      process.exit(1);
    }

    let cardServices = await container.lookup(`hub:card-services`);
    await Promise.all(
      cards.map(async card => {
        try {
          await cardServices.get(Session.INTERNAL_PRIVILEGED, card.data.id, 'embedded');
        } catch (err) {
          if (err.status !== 404) {
            throw err;
          }
          await cardServices.create(Session.INTERNAL_PRIVILEGED, card);
        }
      })
    );
  }

  setInterval(() => container.lookup('hub:indexers').update({ dontWaitForJob: true }), 600000);
}

async function loadSeeds(container, seedModels) {
  if (!container) {
    return;
  }

  let writers = container.lookup('hub:writers');

  for (let model of seedModels) {
    if (model.readable) {
      await writers.createBinary(Session.INTERNAL_PRIVILEGED, 'cardstack-files', model);
    } else {
      await writers.create(Session.INTERNAL_PRIVILEGED, model.type, { data: model });
    }
  }

  await container.lookup('hub:indexers').update({ forceRefresh: true });
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

    let readyPromise = new Promise(function(r) {
      readyResolver = r;
    });

    // Eventually we'll pass a connection instance into the hub, for triggering rebuilds.
    // For now, it just has the side effect of shutting the hub down properly when it's time.
    new EmberConnection({
      orchestrator,
      ready: readyPromise,
      heartbeat: opts.heartbeat,
    });

    await orchestrator.ready;
  }

  log.info('Starting main hub server');
  let container = await wireItUp(projectDir, encryptionKeys, dataSources, opts);
  let app = new Koa();
  app.use(httpLogging);
  app.use(container.lookup('hub:middleware-stack').middleware());
  log.info('Main hub initialized');
  if (opts.containerized) {
    readyResolver();
  }
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
