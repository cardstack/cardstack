/* eslint-disable no-process-exit */

import Koa from 'koa';
import logger from '@cardstack/logger';
import { Registry, Container, RegistryCallback } from './di/dependency-injection';

import AuthenticationMiddleware from './authentication-middleware';
import DevelopmentConfig from './development-config';
import DevelopmentProxyMiddleware from './development-proxy-middleware';
import SessionRoute from './routes/session';
import { AuthenticationUtils } from './utils/authentication';
import JsonapiMiddleware from './jsonapi-middleware';
import NonceTracker from './nonce-tracker';
import { Clock } from './utils/clock';
import { ShutdownHelper } from './shutdown-helper';
const log = logger('cardstack/hub');

export function wireItUp(registryCallback?: RegistryCallback): Container {
  let registry = new Registry();
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('clock', Clock);
  registry.register('development-config', DevelopmentConfig);
  registry.register('development-proxy-middleware', DevelopmentProxyMiddleware);
  registry.register('jsonapi-middleware', JsonapiMiddleware);
  registry.register('nonce-tracker', NonceTracker);
  registry.register('session-route', SessionRoute);
  registry.register('shutdown-helper', ShutdownHelper);
  if (registryCallback) {
    registryCallback(registry);
  }
  return new Container(registry);
}

export async function makeServer(registryCallback?: RegistryCallback) {
  let container = wireItUp(registryCallback);

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

  app.on('close', async function () {
    (await lookupShutdownHelper(container)).onShutdown();
  });

  return app;
}

async function lookupShutdownHelper(container: Container): Promise<ShutdownHelper> {
  let instance = await container.lookup('shutdown-helper');
  return (instance as unknown) as ShutdownHelper;
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

  return runServer(startupConfig()).catch((err: Error) => {
    log.error('Server failed to start cleanly: %s', err.stack || err);
    process.exit(-1);
  });
}

export function bootServerForTesting(config: StartupConfig) {
  logger.configure({
    defaultLevel: 'warn',
  });
  process.on('warning', (warning: Error) => {
    if (warning.stack) {
      process.stderr.write(warning.stack);
    }
  });

  return runServer(config).catch((err: Error) => {
    log.error('Server failed to start cleanly: %s', err.stack || err);
    process.exit(-1);
  });
}

export function bootEnvironment() {
  return wireItUp();
}

async function runServer(config: StartupConfig) {
  let app = await makeServer(config.registryCallback);
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
}

function startupConfig(): StartupConfig {
  let config: StartupConfig = {
    port: 3000,
    registryCallback: undefined,
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
