/* eslint-disable no-process-exit */

import Koa from 'koa';
import logger from '@cardstack/logger';
import { Registry, Container } from './dependency-injection';

import JSONAPIMiddleware from './jsonapi-middleware';
import CardsService from './cards-service';
import { ModuleService } from './module-service';
import AuthenticationMiddleware from './authentication-middleware';

// TODO: we need to let cards register services in a safely namespaced way,
// instead of this hack
import { EphemeralStorage } from '../../cards/ephemeral-realm/storage';

import PgClient from './pgsearch/pgclient';
import IndexingService from './indexing';
import Queue from './queue/queue';

const log = logger('cardstack/server');

export async function wireItUp() {
  let registry = new Registry();
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('jsonapi-middleware', JSONAPIMiddleware);
  registry.register('ephemeralStorage', EphemeralStorage);
  registry.register('cards', CardsService);
  registry.register('modules', ModuleService);
  registry.register('pgclient', PgClient);
  registry.register('indexing', IndexingService);
  registry.register('queue', Queue);
  return new Container(registry);
}

export async function makeServer(container?: Container) {
  if (!container) {
    container = await wireItUp();
  }
  let app = new Koa();
  app.use(cors);
  app.use(httpLogging);
  app.use((await container.lookup('authentication-middleware')).middleware());
  app.use((await container.lookup('jsonapi-middleware')).middleware());
  return app;
}

export function bootEnvironment() {
  if (process.env.EMBER_ENV === 'test') {
    logger.configure({
      defaultLevel: 'warn',
    });
  } else {
    logger.configure({
      defaultLevel: 'warn',
      logLevels: [['cardstack/*', 'info']],
    });
  }

  process.on('warning', (warning: Error) => {
    if (warning.stack) {
      process.stderr.write(warning.stack);
    }
  });

  if (process.connected === false) {
    // This happens if we were started by another node process with IPC
    // and that parent has already died by the time we got here.
    //
    // (If we weren't started under IPC, `process.connected` is
    // undefined, so this never happens.)
    log.info(`Shutting down because connected parent process has already exited.`);
    process.exit(0);
  }
  process.on('disconnect', () => {
    log.info(`Hub shutting down because connected parent process exited.`);
    process.exit(0);
  });

  runServer(startupConfig()).catch((err: Error) => {
    log.error('Server failed to start cleanly: %s', err.stack || err);
    process.exit(-1);
  });
}

async function runServer(config: StartupConfig) {
  let app = await makeServer();
  app.listen(config.port);
  log.info('server listening on %s', config.port);
  if (process.connected) {
    process.send!('hub hello');
  }
}

interface StartupConfig {
  port: number;
}

function startupConfig(): StartupConfig {
  let config: StartupConfig = {
    port: 3000,
  };
  if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
  }
  return config;
}

async function httpLogging(ctxt: Koa.Context, next: Koa.Next) {
  log.info('start %s %s', ctxt.request.method, ctxt.request.originalUrl);
  await next();
  log.info('finish %s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
}

export async function cors(ctxt: Koa.Context, next: Koa.Next) {
  ctxt.response.set('Access-Control-Allow-Origin', '*');
  if (ctxt.request.method === 'OPTIONS') {
    ctxt.response.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    ctxt.response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, X-Requested-With');
    ctxt.status = 200;
    return;
  }
  await next();
}
