/* eslint-disable no-process-exit */

import Koa from 'koa';
import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';
import { Helpers, LogFunctionFactory, Logger, run as runWorkers } from 'graphile-worker';
import { LogLevel, LogMeta } from '@graphile/logger';
import config from 'config';
import packageJson from './package.json';
import { Registry, Container, RegistryCallback, ContainerCallback } from './di/dependency-injection';

import AuthenticationMiddleware from './services/authentication-middleware';
import DatabaseManager from './services/database-manager';
import DevelopmentConfig from './services/development-config';
import DevelopmentProxyMiddleware from './services/development-proxy-middleware';
import WyreService from './services/wyre';
import BoomRoute from './routes/boom';
import SessionRoute from './routes/session';
import PrepaidCardColorSchemesRoute from './routes/prepaid-card-color-schemes';
import PrepaidCardColorSchemeSerializer from './services/serializers/prepaid-card-color-scheme-serializer';
import PrepaidCardPatternSerializer from './services/serializers/prepaid-card-pattern-serializer';
import PrepaidCardPatternsRoute from './routes/prepaid-card-patterns';
import PrepaidCardCustomizationSerializer from './services/serializers/prepaid-card-customization-serializer';
import PrepaidCardCustomizationsRoute from './routes/prepaid-card-customizations';
import PrepaidCardInventory from './services/prepaid-card-inventory';
import PersistOffChainPrepaidCardCustomizationTask from './tasks/persist-off-chain-prepaid-card-customization';
import PersistOffChainMerchantInfoTask from './tasks/persist-off-chain-merchant-info';
import MerchantInfosRoute from './routes/merchant-infos';
import CustodialWalletRoute from './routes/custodial-wallet';
import WyreCallbackRoute from './routes/wyre-callback';
import MerchantInfoSerializer from './services/serializers/merchant-info-serializer';
import MerchantInfoQueries from './services/queries/merchant-info';
import { AuthenticationUtils } from './utils/authentication';
import JsonapiMiddleware from './services/jsonapi-middleware';
import CallbacksMiddleware from './services/callbacks-middleware';
import NonceTracker from './services/nonce-tracker';
import WorkerClient from './services/worker-client';
import { Clock } from './services/clock';
import boom from './tasks/boom';
import s3PutJson from './tasks/s3-put-json';

const serverLog = logger('hub/server');
const workerLog = logger('hub/worker');

export function wireItUp(registryCallback?: RegistryCallback): Container {
  let registry = new Registry();
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('clock', Clock);
  registry.register('custodial-wallet-route', CustodialWalletRoute);
  registry.register('database-manager', DatabaseManager);
  registry.register('development-config', DevelopmentConfig);
  registry.register('development-proxy-middleware', DevelopmentProxyMiddleware);
  registry.register('jsonapi-middleware', JsonapiMiddleware);
  registry.register('callbacks-middleware', CallbacksMiddleware);
  registry.register('nonce-tracker', NonceTracker);
  registry.register('boom-route', BoomRoute);
  registry.register('session-route', SessionRoute);
  registry.register('persist-off-chain-prepaid-card-customization', PersistOffChainPrepaidCardCustomizationTask);
  registry.register('persist-off-chain-merchant-info', PersistOffChainMerchantInfoTask);
  registry.register('prepaid-card-customizations-route', PrepaidCardCustomizationsRoute);
  registry.register('prepaid-card-customization-serializer', PrepaidCardCustomizationSerializer);
  registry.register('prepaid-card-color-schemes-route', PrepaidCardColorSchemesRoute);
  registry.register('prepaid-card-color-scheme-serializer', PrepaidCardColorSchemeSerializer);
  registry.register('prepaid-card-patterns-route', PrepaidCardPatternsRoute);
  registry.register('prepaid-card-pattern-serializer', PrepaidCardPatternSerializer);
  registry.register('prepaid-card-inventory', PrepaidCardInventory);
  registry.register('merchant-infos-route', MerchantInfosRoute);
  registry.register('merchant-info-serializer', MerchantInfoSerializer);
  registry.register('merchant-info-queries', MerchantInfoQueries);
  registry.register('worker-client', WorkerClient);
  registry.register('wyre', WyreService);
  registry.register('wyre-callback-route', WyreCallbackRoute);
  if (registryCallback) {
    registryCallback(registry);
  }
  return new Container(registry);
}

export async function makeServer(registryCallback?: RegistryCallback, containerCallback?: ContainerCallback) {
  let container = wireItUp(registryCallback);
  containerCallback?.(container);

  initSentry();

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
  app.use(((await container.lookup('callbacks-middleware')) as CallbacksMiddleware).middleware());

  app.use(async (ctx: Koa.Context, _next: Koa.Next) => {
    ctx.body = 'Hello World ' + ctx.environment + '... ' + ctx.host.split(':')[0];
  });

  function onError(err: Error, ctx: Koa.Context) {
    Sentry.withScope(function (scope) {
      scope.addEventProcessor(function (event) {
        return Sentry.Handlers.parseRequest(event, ctx.request);
      });
      Sentry.captureException(err);
    });
  }

  async function onClose() {
    await container.teardown();
    app.off('close', onClose);
    app.off('error', onError);
  }
  app.on('close', onClose);
  app.on('error', onError);

  return app;
}

function initSentry() {
  if (config.get('sentry.enabled')) {
    Sentry.init({
      dsn: config.get('sentry.dsn'),
      enabled: config.get('sentry.enabled'),
      environment: config.get('sentry.environment'),
      release: 'hub@' + packageJson.version,
    });
  }
}

export function bootServer() {
  if (process.env.EMBER_ENV === 'test') {
    logger.configure({
      defaultLevel: 'warn',
    });
  } else {
    logger.configure({
      defaultLevel: 'warn',
      logLevels: [['hub/*', 'info']],
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
    serverLog.info(`Shutting down because connected parent process has already exited.`);
    process.exit(0);
  }
  function onDisconnect() {
    serverLog.info(`Hub shutting down because connected parent process exited.`);
    process.exit(0);
  }
  process.on('disconnect', onDisconnect);

  return runServer(startupConfig()).catch((err: Error) => {
    serverLog.error('Server failed to start cleanly: %s', err.stack || err);
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
    serverLog.error('Server failed to start cleanly: %s', err.stack || err);
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

export async function bootWorker() {
  initSentry();

  let workerLogFactory: LogFunctionFactory = (scope: any) => {
    return (level: LogLevel, message: any, meta?: LogMeta) => {
      switch (level) {
        case LogLevel.ERROR:
          workerLog.error(message, scope, meta);
          break;
        case LogLevel.WARNING:
          workerLog.warn(message, scope, meta);
          break;
        case LogLevel.INFO:
          workerLog.info(message, scope, meta);
          break;
        case LogLevel.DEBUG:
          workerLog.info(message, scope, meta);
      }
    };
  };
  let dbConfig = config.get('db') as Record<string, any>;
  let container = wireItUp();
  let runner = await runWorkers({
    logger: new Logger(workerLogFactory),
    connectionString: dbConfig.url,
    taskList: {
      boom: boom,
      'persist-off-chain-prepaid-card-customization': async (payload: any, helpers: Helpers) => {
        let task = await container.instantiate(PersistOffChainPrepaidCardCustomizationTask);
        return task.perform(payload, helpers);
      },
      'persist-off-chain-merchant-info': async (payload: any, helpers: Helpers) => {
        let task = await container.instantiate(PersistOffChainMerchantInfoTask);
        return task.perform(payload, helpers);
      },
      's3-put-json': s3PutJson,
    },
  });

  runner.events.on('job:error', ({ error, job }) => {
    Sentry.withScope(function (scope) {
      scope.setTags({
        jobId: job.id,
        jobTask: job.task_identifier,
      });
      Sentry.captureException(error);
    });
  });

  await runner.promise;
}

async function runServer(config: Partial<StartupConfig>) {
  let app = await makeServer(config.registryCallback, config.containerCallback);
  let server = app.listen(config.port);
  serverLog.info('server listening on %s', config.port);
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
  serverLog.info('start %s %s', ctxt.request.method, ctxt.request.originalUrl);
  await next();
  serverLog.info('finish %s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
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
