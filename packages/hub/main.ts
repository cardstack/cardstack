import Koa from 'koa';
import logger from '@cardstack/logger';
import { Registry, Container } from './dependency-injection';

import JSONAPIMiddleware from './jsonapi-middleware';
import CardsService from './cards-service';
import AuthenticationMiddleware from './authentication-middleware';
import { EphemeralStorage } from './ephemeral/storage';
import PgClient from './pgsearch/pgclient';
import IndexingService from './indexing';
import Queue from './queue/queue';

const log = logger('cardstack/server');

export interface ContainerOptions {
  suppressInitialIndex: boolean;
}

export async function wireItUp(opts?: ContainerOptions) {
  let registry = new Registry();
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('jsonapi-middleware', JSONAPIMiddleware);
  registry.register('ephemeralStorage', EphemeralStorage);
  registry.register('cards', CardsService);
  registry.register('pgclient', PgClient);
  registry.register('indexing', IndexingService);
  registry.register('queue', Queue);
  let container = new Container(registry);

  if (!opts?.suppressInitialIndex) {
    let indexing = await container.lookup('indexing');

    // TODO careful awaiting here. it might be a good idea to ignore this promise
    // when not running tests so that we don't interfere with getting the server
    // to start listening immediately in the event that first time index takes a
    // really long time and the server requires health checks in order to stay
    // running.
    await indexing.update();
  }

  return container;
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

async function httpLogging(ctxt: Koa.Context, next: Koa.Next) {
  log.info('start %s %s', ctxt.request.method, ctxt.request.originalUrl);
  await next();
  log.info('finish %s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
}

function cors(ctxt: Koa.Context, next: Koa.Next) {
  ctxt.response.set('Access-Control-Allow-Origin', '*');
  if (ctxt.request.method === 'OPTIONS') {
    ctxt.response.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    ctxt.response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, X-Requested-With');
    ctxt.status = 200;
    return;
  }
  next();
}
