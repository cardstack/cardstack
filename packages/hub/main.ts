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
import { myOrigin } from '@cardstack/core/origin';
import { Session } from '@cardstack/core/session';
import { cardDocument } from '@cardstack/core/card-document';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

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

  await setupRealms(container);

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

async function setupRealms(container: Container) {
  let cards = (await container.lookup('cards')).as(Session.INTERNAL_PRIVILEGED);
  const metaRealm = `${myOrigin}/api/realms/meta`;

  let hasMetaRealm;
  let metaRealmCard = cardDocument()
    .withAttributes({
      csRealm: metaRealm,
      csId: metaRealm,
      csTitle: `Meta Realm`,
      csDescription: `This card controls the configuration of the meta realm which is the realm that holds all of your realm cards.`,
    })
    // TODO right now this is hard coded to the ephemeral-realm. Once the git
    // realm is ready we should use that instead (or alternatively the file
    // realm), when the hub environment is not in test mode.
    .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi;
  try {
    await cards.get({ csRealm: metaRealm, csId: metaRealm }, metaRealmCard);
    hasMetaRealm = true;
  } catch (e) {
    if (e.status !== 404) {
      throw e;
    }
    hasMetaRealm = false;
  }

  if (!hasMetaRealm) {
    log.info(`Creating ephemeral-based meta realm.`);
    await cards.create(metaRealm, metaRealmCard);
  }

  let hasDefaultRealm;
  try {
    await cards.get({ csRealm: metaRealm, csId: `${myOrigin}/api/realms/default` });
    hasDefaultRealm = true;
  } catch (e) {
    if (e.status !== 404) {
      throw e;
    }
    hasDefaultRealm = false;
  }
  if (!hasDefaultRealm) {
    log.info(`Creating ephemeral-based default realm.`);
    await cards.create(
      metaRealm,
      cardDocument()
        .withAttributes({
          csRealm: metaRealm,
          csId: `${myOrigin}/api/realms/default`,
          csTitle: `Default Realm`,
          csDescription: `This card controls the configuration of your hub's default realm. This is the realm that cards are written to by default.`,
        })
        // TODO right now this is hard coded to the ephemeral-realm. Once the git
        // realm is ready we should use that instead (or alternatively the file
        // realm), when the hub environment is not in test mode.
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    );
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
