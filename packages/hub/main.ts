/* eslint-disable no-process-exit */

import Koa from 'koa';
import logger from '@cardstack/logger';
import { Registry, Container } from './dependency-injection';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirp } from 'fs-extra';

import JSONAPIMiddleware from './jsonapi-middleware';
import CardsService from './cards-service';
import { ModuleService } from './module-service';
import AuthenticationMiddleware from './authentication-middleware';

// TODO: we need to let cards register services in a safely namespaced way,
// instead of this hack
import { EphemeralStorage } from '@cardstack/ephemeral-realm-card/storage';
import { FilesTracker } from '@cardstack/files-realm-card/tracker';

import PgClient from './pgsearch/pgclient';
import IndexingService from './indexing';
import Queue from './queue/queue';
import { myOrigin } from '@cardstack/core/origin';
import { Session } from '@cardstack/core/session';
import { cardDocument } from '@cardstack/core/card-document';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import Change from '@cardstack/git-realm-card/lib/change';
import { existsSync } from 'fs';
import { SingleResourceDoc } from 'jsonapi-typescript';

const INDEXING_INTERVAL = 10 * 60 * 1000;
const log = logger('cardstack/server');
const metaRealm = `${myOrigin}/api/realms/meta`;
const cardCatalogRealm = 'https://cardstack.com/api/realms/card-catalog';
const cardCatalogRepo = 'https://github.com/cardstack/card-catalog.git';
const localDefaultRealmRepo = join(homedir(), '.cardstack', 'default-realm');
const localMetaRealmRepo = join(homedir(), '.cardstack', 'meta-realm');
const localCardCatalogRepo = join(homedir(), '.cardstack', 'card-catalog-realm');

export async function wireItUp() {
  let registry = new Registry();
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('jsonapi-middleware', JSONAPIMiddleware);
  registry.register('ephemeralStorage', EphemeralStorage);
  registry.register('filesTracker', FilesTracker);
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

  if (process.env.EMBER_ENV !== 'test') {
    await startQueueRunners(container);

    // Intentionally not awaiting this promise to prevent indexing from blocking
    // the hub booting process. Since we skip this in tests, we shouldn't have
    // to worry about leaking async.
    synchronizeIndex(container);
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

async function startQueueRunners(container: Container) {
  let queue = await container.lookup('queue');
  await queue.launchJobRunner();
}

async function synchronizeIndex(container: Container) {
  let indexing = await container.lookup('indexing');
  while (true) {
    try {
      await indexing.update();
    } catch (e) {
      // Logging this error since we are not intentionally awaiting this
      // function which means that this exception would otherwise be hidden
      // behind a rejected promise that we are ignoring.
      log.error(`Encountered an unexpected error while indexing: ${e.message || e.detail}\n${JSON.stringify(e.stack)}`);
      throw e;
    }
    await new Promise(res => setTimeout(() => res(), INDEXING_INTERVAL));
  }
}

async function setupRealms(container: Container) {
  let metaRealmConfig: RealmAttrs = {
    csRealm: metaRealm,
    csId: metaRealm,
    csTitle: 'Meta Realm',
    csDescription: `This card controls the configuration of the meta realm which is the realm that holds all of your realm cards.`,
  };

  let defaultRealmConfig: RealmAttrs = {
    csRealm: metaRealm,
    csId: `${myOrigin}/api/realms/default`,
    csTitle: `Default Realm`,
    csDescription: `This card controls the configuration of your hub's default realm. This is the realm that cards are written to by default.`,
  };

  let cardCatalogRealmConfig: RealmAttrs = {
    csRealm: metaRealm,
    csId: cardCatalogRealm,
    csTitle: 'Card Catalog',
    csDescription: `The Cardstack curated catalog of cards.`,
  };

  if (process.env.EMBER_ENV !== 'test') {
    if (process.env.META_REALM_URL) {
      metaRealmConfig.remoteUrl = process.env.META_REALM_URL;
      metaRealmConfig.remoteCacheDir = localMetaRealmRepo;
    } else {
      metaRealmConfig.repo = localMetaRealmRepo;
    }
    if (process.env.DEFAULT_REALM_URL) {
      defaultRealmConfig.remoteUrl = process.env.DEFAULT_REALM_URL;
      defaultRealmConfig.remoteCacheDir = localDefaultRealmRepo;
    } else {
      defaultRealmConfig.repo = localDefaultRealmRepo;
    }

    cardCatalogRealmConfig.remoteUrl = cardCatalogRepo;
    cardCatalogRealmConfig.remoteCacheDir = localCardCatalogRepo;
  }

  await assertRealmExists(container, metaRealmConfig);
  await assertRealmExists(container, defaultRealmConfig);
  await assertRealmExists(container, cardCatalogRealmConfig);
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

interface RealmAttrs {
  csRealm: string;
  csId: string;
  csTitle: string;
  csDescription: string;
  repo?: string;
  remoteUrl?: string;
  remoteCacheDir?: string;
}

async function assertRealmExists(container: Container, realmAttrs: RealmAttrs): Promise<void> {
  let { csRealm, csId, repo, remoteCacheDir } = realmAttrs;
  let realmCardDoc = getRealmCardDoc(realmAttrs);

  let cards = (await container.lookup('cards')).as(Session.INTERNAL_PRIVILEGED);
  let hasRealm: boolean;
  try {
    if (csRealm === metaRealm && csId === metaRealm) {
      // In the case the meta realm doesn't exist yet we need to supply a meta
      // realm card document that the cards.get() can fall back on, as the meta
      // realm document needs to be available in order for cards.get() to work.
      await cards.get({ csRealm, csId }, realmCardDoc);
    } else {
      await cards.get({ csRealm, csId });
    }
    hasRealm = true;
  } catch (e) {
    if (e.status !== 404) {
      throw e;
    }
    hasRealm = false;
  }

  if (!hasRealm) {
    log.info(`Creating realm ${csId}.`);
    if (repo) {
      await assertRepoExists(repo);
    } else if (remoteCacheDir) {
      await mkdirp(remoteCacheDir);
    }

    try {
      await cards.create(metaRealm, realmCardDoc);
    } catch (e) {
      if (csRealm === metaRealm && csId === metaRealm && e.status === 409 && e.detail.includes('is already in use')) {
        log.info('Indexing meta realm to discover all the realms for this hub');
        await indexMetaRealm(container, realmCardDoc);
      } else {
        throw e;
      }
    }
  }
}

async function indexMetaRealm(container: Container, metaRealmDoc: SingleResourceDoc): Promise<void> {
  let indexing = await container.lookup('indexing');
  await indexing.indexMetaRealm(metaRealmDoc);
}

function getRealmCardDoc(realmAttrs: RealmAttrs): SingleResourceDoc {
  let { csRealm, csId, csTitle, csDescription, repo, remoteUrl, remoteCacheDir } = realmAttrs;
  // in order to prevent test leakage, we'll use ephemeral-based realms when it
  // looks like you are running tests.
  if (process.env.EMBER_ENV === 'test') {
    return cardDocument()
      .withAttributes({
        csRealm,
        csId,
        csTitle,
        csDescription,
      })
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi;
  } else {
    let doc = cardDocument()
      .withAttributes({
        csRealm,
        csId,
        csTitle,
        csDescription,
      })
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'git-realm' });

    if (repo) {
      doc.withAttributes({ repo });
    } else if (remoteUrl && remoteCacheDir) {
      doc.withAttributes({ remoteUrl, remoteCacheDir });
    }

    return doc.jsonapi;
  }
}

// TODO probably we should move this into the realm card
async function assertRepoExists(path: string) {
  if (!existsSync(path)) {
    await mkdirp(path);
    let change = await Change.createInitial(path, 'master');
    await change.finalize({
      authorName: 'hub',
      authorEmail: 'hub@cardstack',
      message: 'Created realm',
    });
  }
}
