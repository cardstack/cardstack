/* eslint-disable no-process-exit */

import Koa from 'koa';
import fetch from 'node-fetch';
import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';
import { Helpers, LogFunctionFactory, Logger, run as runWorkers } from 'graphile-worker';
import { LogLevel, LogMeta } from '@graphile/logger';
import Bot from '@cardstack/cardpay-bot';
import config from 'config';
import packageJson from './package.json';
import { Registry, Container, RegistryCallback } from '@cardstack/di';

import DatabaseManager from '@cardstack/db';
import AuthenticationMiddleware from './services/authentication-middleware';
import DevelopmentConfig from './services/development-config';
import DevelopmentProxyMiddleware from './services/development-proxy-middleware';
import WyreService from './services/wyre';
import BoomRoute from './routes/boom';
import ExchangeRatesRoute from './routes/exchange-rates';
import SessionRoute from './routes/session';
import PrepaidCardColorSchemesRoute from './routes/prepaid-card-color-schemes';
import PrepaidCardColorSchemeSerializer from './services/serializers/prepaid-card-color-scheme-serializer';
import PrepaidCardPatternSerializer from './services/serializers/prepaid-card-pattern-serializer';
import PrepaidCardPatternsRoute from './routes/prepaid-card-patterns';
import PrepaidCardCustomizationSerializer from './services/serializers/prepaid-card-customization-serializer';
import PrepaidCardCustomizationsRoute from './routes/prepaid-card-customizations';
import OrdersRoute from './routes/orders';
import ReservationsRoute from './routes/reservations';
import InventoryRoute from './routes/inventory';
import RelayService from './services/relay';
import SubgraphService from './services/subgraph';
import OrderService from './services/order';
import InventoryService from './services/inventory';
import PersistOffChainPrepaidCardCustomizationTask from './tasks/persist-off-chain-prepaid-card-customization';
import PersistOffChainMerchantInfoTask from './tasks/persist-off-chain-merchant-info';
import MerchantInfosRoute from './routes/merchant-infos';
import CustodialWalletRoute from './routes/custodial-wallet';
import WyreCallbackRoute from './routes/wyre-callback';
import MerchantInfoSerializer from './services/serializers/merchant-info-serializer';
import MerchantInfoQueries from './services/queries/merchant-info';
import { AuthenticationUtils } from './utils/authentication';
import ApiRouter from './services/api-router';
import CallbacksRouter from './services/callbacks-router';
import HealthCheck from './services/health-check';
import NonceTracker from './services/nonce-tracker';
import WorkerClient from './services/worker-client';
import { Clock } from './services/clock';
import Web3Service from './services/web3';
import boom from './tasks/boom';
import s3PutJson from './tasks/s3-put-json';
import { CardstackError } from './utils/error';
import { environment, httpLogging } from './middleware';
import cors from '@koa/cors';
import ExchangeRatesService from './services/exchange-rates';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

const workerLog = logger('hub/worker');
const botLog = logger('hub/bot');

export interface ServerConfig {
  port?: number;
  registryCallback?: undefined | ((registry: Registry) => void);
  containerCallback?: undefined | ((container: Container) => void);
}

export function wireItUp(registryCallback?: RegistryCallback): Container {
  let registry = new Registry();
  registry.register('api-router', ApiRouter);
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('boom-route', BoomRoute);
  registry.register('callbacks-router', CallbacksRouter);
  registry.register('clock', Clock);
  registry.register('custodial-wallet-route', CustodialWalletRoute);
  registry.register('database-manager', DatabaseManager);
  registry.register('development-config', DevelopmentConfig);
  registry.register('development-proxy-middleware', DevelopmentProxyMiddleware);
  registry.register('exchange-rates', ExchangeRatesService);
  registry.register('exchange-rates-route', ExchangeRatesRoute);
  registry.register('health-check', HealthCheck);
  registry.register('inventory', InventoryService);
  registry.register('inventory-route', InventoryRoute);
  registry.register('merchant-infos-route', MerchantInfosRoute);
  registry.register('merchant-info-serializer', MerchantInfoSerializer);
  registry.register('merchant-info-queries', MerchantInfoQueries);
  registry.register('nonce-tracker', NonceTracker);
  registry.register('order', OrderService);
  registry.register('orders-route', OrdersRoute);
  registry.register('persist-off-chain-prepaid-card-customization', PersistOffChainPrepaidCardCustomizationTask);
  registry.register('persist-off-chain-merchant-info', PersistOffChainMerchantInfoTask);
  registry.register('prepaid-card-customizations-route', PrepaidCardCustomizationsRoute);
  registry.register('prepaid-card-customization-serializer', PrepaidCardCustomizationSerializer);
  registry.register('prepaid-card-color-schemes-route', PrepaidCardColorSchemesRoute);
  registry.register('prepaid-card-color-scheme-serializer', PrepaidCardColorSchemeSerializer);
  registry.register('prepaid-card-patterns-route', PrepaidCardPatternsRoute);
  registry.register('prepaid-card-pattern-serializer', PrepaidCardPatternSerializer);
  registry.register('relay', RelayService);
  registry.register('reservations-route', ReservationsRoute);
  registry.register('session-route', SessionRoute);
  registry.register('subgraph', SubgraphService);
  registry.register('worker-client', WorkerClient);
  registry.register('web3', Web3Service);
  registry.register('wyre', WyreService);
  registry.register('wyre-callback-route', WyreCallbackRoute);
  if (registryCallback) {
    registryCallback(registry);
  }
  return new Container(registry);
}

const LOGGER = logger('hub/server');

// Empty for now
const DEFAULT_CONFIG: ServerConfig = {};
export class HubServer {
  logger = LOGGER;
  static logger = LOGGER;

  static async create(config?: ServerConfig): Promise<HubServer> {
    let container = wireItUp(config?.registryCallback);
    config = Object.assign({}, DEFAULT_CONFIG, config);

    initSentry();

    let app = new Koa<Koa.DefaultState, Koa.Context>()
      .use(CardstackError.withJsonErrorHandling)
      .use(environment)
      .use(cors({ origin: '*', allowHeaders: 'Authorization, Content-Type, If-Match, X-Requested-With' }))
      .use(httpLogging);

    app.use(((await container.lookup('authentication-middleware')) as AuthenticationMiddleware).middleware());
    app.use(((await container.lookup('development-proxy-middleware')) as DevelopmentProxyMiddleware).middleware());
    app.use(((await container.lookup('api-router')) as ApiRouter).routes());
    app.use(((await container.lookup('callbacks-router')) as CallbacksRouter).routes());
    app.use(((await container.lookup('health-check')) as HealthCheck).routes()); // Setup health-check at "/"

    function onError(err: Error, ctx: Koa.Context) {
      LOGGER.error(`Unhandled error:`, err);
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

    return new this(app, container, config);
  }
  private constructor(
    public app: Koa<Koa.DefaultState, Koa.Context>,
    public container: Container,
    private config: ServerConfig
  ) {}

  teardown() {
    this.container.teardown();
  }

  listen() {
    let instance = this.app.listen(this.config.port);
    this.logger.info('server listening on %s', this.config.port);

    if (process.connected) {
      process.send!('hub hello');
    }

    instance.on('close', () => {
      this.app.emit('close'); // supports our ShutdownHelper
    });

    return instance;
  }
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

export async function bootBot() {
  botLog.info('Booting bot');
  initSentry();

  let container = wireItUp();
  try {
    let bot = await container.instantiate(Bot);
    await bot.start();
  } catch (e) {
    botLog.error('Unexpected error', e);
    Sentry.withScope(function () {
      Sentry.captureException(e);
    });
  }
}
