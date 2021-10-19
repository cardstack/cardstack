/* eslint-disable no-process-exit */

import config from 'config';
import Koa from 'koa';
import { environment, httpLogging, errorMiddleware } from './middleware';
import cors from '@koa/cors';
import fetch from 'node-fetch';
import * as Sentry from '@sentry/node';

import { Helpers, LogFunctionFactory, Logger, run as runWorkers } from 'graphile-worker';
import { LogLevel, LogMeta } from '@graphile/logger';
import Bot from '@cardstack/cardbot';
import packageJson from './package.json';
import { Registry, Container, RegistryCallback } from '@cardstack/di';

import DatabaseManager from '@cardstack/db';
import WalletConnectService from '@cardstack/cardbot/services/wallet-connect';
import { HubServerConfig } from './interfaces';

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
import PersistOffChainCardSpaceTask from './tasks/persist-off-chain-card-space';
import MerchantInfosRoute from './routes/merchant-infos';
import CustodialWalletRoute from './routes/custodial-wallet';
import WyreCallbackRoute from './routes/wyre-callback';
import CardSpacesRoute from './routes/card-spaces';
import MerchantInfoSerializer from './services/serializers/merchant-info-serializer';
import MerchantInfoQueries from './services/queries/merchant-info';
import CardSpaceQueries from './services/queries/card-space';
import CardSpaceSerializer from './services/serializers/card-space-serializer';
import CardSpaceValidator from './services/validators/card-space';
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
import RealmManager from './services/realm-manager';
import { serverLog, workerLog, botLog } from './utils/logger';

import CardBuilder from './services/card-builder';
import CardRoutes from './routes/card-routes';
import { CardCacheConfig } from './services/card-cache-config';
import CardCache from './services/card-cache';
import CardWatcher from './services/card-watcher';
import ExchangeRatesService from './services/exchange-rates';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

export function createContainer(registryCallback?: RegistryCallback): Container {
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
  registry.register('persist-off-chain-card-space', PersistOffChainCardSpaceTask);
  registry.register('prepaid-card-customizations-route', PrepaidCardCustomizationsRoute);
  registry.register('prepaid-card-customization-serializer', PrepaidCardCustomizationSerializer);
  registry.register('prepaid-card-color-schemes-route', PrepaidCardColorSchemesRoute);
  registry.register('prepaid-card-color-scheme-serializer', PrepaidCardColorSchemeSerializer);
  registry.register('prepaid-card-patterns-route', PrepaidCardPatternsRoute);
  registry.register('prepaid-card-pattern-serializer', PrepaidCardPatternSerializer);
  registry.register('card-space-serializer', CardSpaceSerializer);
  registry.register('card-space-validator', CardSpaceValidator);
  registry.register('card-space-queries', CardSpaceQueries);
  registry.register('card-spaces-route', CardSpacesRoute);
  registry.register('relay', RelayService);
  registry.register('reservations-route', ReservationsRoute);
  registry.register('session-route', SessionRoute);
  registry.register('subgraph', SubgraphService);
  registry.register('wallet-connect', WalletConnectService);
  registry.register('worker-client', WorkerClient);
  registry.register('web3', Web3Service);
  registry.register('wyre', WyreService);
  registry.register('wyre-callback-route', WyreCallbackRoute);

  if (process.env.COMPILER) {
    registry.register('realm-manager', RealmManager);
    registry.register('card-cache-config', CardCacheConfig);
    registry.register('card-cache', CardCache);
    registry.register('card-routes', CardRoutes);
    registry.register('card-builder', CardBuilder);
    registry.register('card-watcher', CardWatcher);
  }

  if (registryCallback) {
    registryCallback(registry);
  }
  return new Container(registry);
}

export class HubServer {
  logger = serverLog;
  static logger = serverLog;

  static async create(serverConfig?: Partial<HubServerConfig>): Promise<HubServer> {
    let container = createContainer(serverConfig?.registryCallback);

    let fullConfig = Object.assign({}, serverConfig) as HubServerConfig;

    initSentry();

    let app = new Koa<Koa.DefaultState, Koa.Context>()
      .use(errorMiddleware)
      .use(environment)
      .use(cors({ origin: '*', allowHeaders: 'Authorization, Content-Type, If-Match, X-Requested-With' }))
      .use(httpLogging);

    app.use((await container.lookup('authentication-middleware')).middleware());
    app.use((await container.lookup('development-proxy-middleware')).middleware());
    app.use((await container.lookup('api-router')).routes());
    app.use((await container.lookup('callbacks-router')).routes());

    if (process.env.COMPILER) {
      let cardRoutes = await container.lookup('card-routes');
      app.use(cardRoutes.routes());

      setupCardRouting(cardRoutes, fullConfig);
    }

    app.use((await container.lookup('health-check')).routes()); // Setup health-check at "/"

    let onError = (err: Error, ctx: Koa.Context) => {
      this.logger.error(`Unhandled error:`, err);
      Sentry.withScope(function (scope) {
        scope.addEventProcessor(function (event) {
          return Sentry.Handlers.parseRequest(event, ctx.request);
        });
        Sentry.captureException(err);
      });
    };

    async function onClose() {
      await container.teardown();
      app.off('close', onClose);
      app.off('error', onError);
    }
    app.on('close', onClose);
    app.on('error', onError);

    return new this(app, container);
  }

  private constructor(public app: Koa<Koa.DefaultState, Koa.Context>, public container: Container) {}

  async teardown() {
    await this.container.teardown();
  }

  async listen(port = 3000) {
    let instance = this.app.listen(port);
    this.logger.info('server listening on %s', port);

    if (process.connected) {
      process.send!('hub hello');
    }

    instance.on('close', () => {
      this.app.emit('close'); // supports our ShutdownHelper
    });

    return instance;
  }

  async primeCache() {
    if (!process.env.COMPILER) {
      throw new Error('COMPILER feature flag is not present');
    }
    let builder = await this.container.lookup('card-builder');
    await builder.primeCache();
  }

  async watchCards() {
    if (!process.env.COMPILER) {
      throw new Error('COMPILER feature flag is not present');
    }

    let watcher = await this.container.lookup('card-watcher');
    await watcher.watch();
  }
}

/**
 * If the command line or the environment config provides a route card url,
 * setup the card router to use it to resolve path requests
 */
function setupCardRouting(cardRoutes: CardRoutes, serverConfig?: Partial<HubServerConfig>) {
  if (serverConfig && serverConfig.routeCard) {
    cardRoutes.setRoutingCard(serverConfig.routeCard);
  } else if (config.has('compiler.routeCard')) {
    cardRoutes.setRoutingCard(config.get('compiler.routeCard'));
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
  let container = createContainer();
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
      'persist-off-chain-card-space': async (payload: any, helpers: Helpers) => {
        let task = await container.instantiate(PersistOffChainCardSpaceTask);
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

export class HubBot {
  logger = botLog;
  static logger = botLog;

  static async create(serverConfig?: Partial<HubServerConfig>): Promise<HubBot> {
    this.logger.info('Booting bot');
    initSentry();

    let container = createContainer(serverConfig?.registryCallback);
    let bot: Bot | undefined;

    try {
      bot = await container.instantiate(Bot);
      await bot.start();
    } catch (e) {
      this.logger.error('Unexpected error', e);
      Sentry.withScope(function () {
        Sentry.captureException(e);
      });
    }

    if (!bot) {
      throw new Error('Bot could not be created');
    }

    return new this(bot, container);
  }

  private constructor(public bot: Bot, public container: Container) {}

  async teardown() {
    await this.bot.destroy();
    await this.container.teardown();
  }
}
