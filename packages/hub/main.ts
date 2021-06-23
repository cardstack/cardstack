/* eslint-disable no-process-exit */

import Koa from 'koa';
import logger from '@cardstack/logger';
import { Registry, Container, RegistryCallback, ContainerCallback } from './di/dependency-injection';

import AuthenticationMiddleware from './services/authentication-middleware';
import DatabaseManager from './services/database-manager';
import DevelopmentConfig from './services/development-config';
import DevelopmentProxyMiddleware from './services/development-proxy-middleware';
import SessionRoute from './routes/session';
import PrepaidCardColorSchemesRoute from './routes/prepaid-card-color-schemes';
import PrepaidCardPatternsRoute from './routes/prepaid-card-patterns';
import PrepaidCardCustomizationsRoute from './routes/prepaid-card-customizations';
import { AuthenticationUtils } from './utils/authentication';
import JsonapiMiddleware from './services/jsonapi-middleware';
import NonceTracker from './services/nonce-tracker';
import WorkerClient from './services/worker-client';
import { Clock } from './services/clock';
const log = logger('cardstack/hub');

export function wireItUp(registryCallback?: RegistryCallback): Container {
  let registry = new Registry();
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('clock', Clock);
  registry.register('database-manager', DatabaseManager);
  registry.register('development-config', DevelopmentConfig);
  registry.register('development-proxy-middleware', DevelopmentProxyMiddleware);
  registry.register('jsonapi-middleware', JsonapiMiddleware);
  registry.register('nonce-tracker', NonceTracker);
  registry.register('session-route', SessionRoute);
  registry.register('prepaid-card-customizations-route', PrepaidCardCustomizationsRoute);
  registry.register('prepaid-card-color-schemes-route', PrepaidCardColorSchemesRoute);
  registry.register('prepaid-card-patterns-route', PrepaidCardPatternsRoute);
  registry.register('worker-client', WorkerClient);
  if (registryCallback) {
    registryCallback(registry);
  }
  return new Container(registry);
}

export async function makeServer(registryCallback?: RegistryCallback, containerCallback?: ContainerCallback) {
  let container = wireItUp(registryCallback);
  containerCallback?.(container);

  let app = new Koa();
  app.use(async (ctx: Koa.Context, next: Koa.Next) => {
    ctx.environment = process.env.NODE_ENV || 'development';
    return next();
  });
  app.use(cors);
  app.use(httpLogging);
  app.use(((await container.lookup('authentication-middleware')) as AuthenticationMiddleware).middleware());
  app.use(((await container.lookup('development-proxy-middleware')) as DevelopmentProxyMiddleware).middleware());
  app.use(((await container.lookup('jsonapi-middleware')) as JsonapiMiddleware).middleware());

  app.use(async (ctx: Koa.Context, _next: Koa.Next) => {
    ctx.body = 'Hello World ' + ctx.environment + '! ' + ctx.host.split(':')[0];
  });

  async function onClose() {
    await container.teardown();
    app.off('close', onClose);
  }
  app.on('close', onClose);

  return app;
}

export function bootServer() {
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

  function onWarning(warning: Error) {
    if (warning.stack) {
      process.stderr.write(warning.stack);
    }
  }
  process.on('warning', onWarning);

  if (process.connected === false) {
    // This happens if we were started by another node process with IPC
    // and that parent has already died by the time we got here.
    //
    // (If we weren't started under IPC, `process.connected` is
    // undefined, so this never happens.)
    log.info(`Shutting down because connected parent process has already exited.`);
    process.exit(0);
  }
  function onDisconnect() {
    log.info(`Hub shutting down because connected parent process exited.`);
    process.exit(0);
  }
  process.on('disconnect', onDisconnect);

  return runServer(startupConfig()).catch((err: Error) => {
    log.error('Server failed to start cleanly: %s', err.stack || err);
    process.exit(-1);
  });
}

export async function bootServerForTesting(config: Partial<StartupConfig>) {
  logger.configure({
    defaultLevel: 'warn',
  });
  function onWarning(warning: Error) {
    if (warning.stack) {
      process.stderr.write(warning.stack);
    }
  }
  process.on('warning', onWarning);

  let server = await runServer(config).catch((err: Error) => {
    log.error('Server failed to start cleanly: %s', err.stack || err);
    process.exit(-1);
  });

  function onClose() {
    process.off('warning', onWarning);
    server.off('close', onClose);
  }
  server.on('close', onClose);

  return server;
}

export function bootEnvironment() {
  return wireItUp();
}

async function runServer(config: Partial<StartupConfig>) {
  let app = await makeServer(config.registryCallback, config.containerCallback);
  let server = app.listen(config.port);
  log.info('server listening on %s', config.port);
  if (process.connected) {
    process.send!('hub hello');
  }
  server.on('close', function () {
    app.emit('close'); // supports our ShutdownHelper
  });
  return server;
}

interface StartupConfig {
  port: number;
  registryCallback: undefined | ((registry: Registry) => void);
  containerCallback: undefined | ((container: Container) => void);
}

function startupConfig(): StartupConfig {
  let config: StartupConfig = {
    port: 3000,
    registryCallback: undefined,
    containerCallback: undefined,
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
