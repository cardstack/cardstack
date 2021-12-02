/* eslint-disable no-process-exit */

import config from 'config';
import Koa from 'koa';
import { environment, httpLogging, errorMiddleware } from './middleware';
import cors from '@koa/cors';
import fetch from 'node-fetch';
import * as Sentry from '@sentry/node';
import { Memoize } from 'typescript-memoize';

import { Helpers, LogFunctionFactory, Logger, run as runWorkers } from 'graphile-worker';
import { LogLevel, LogMeta } from '@graphile/logger';
import packageJson from './package.json';
import { Registry, Container, inject, getOwner, KnownServices } from '@cardstack/di';

import DatabaseManager from '@cardstack/db';
import WalletConnectService from './services/discord-bots/hub-bot/services/wallet-connect';

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
import WyrePricesRoute from './routes/wyre-prices';
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
import Upload from './routes/upload';
import UploadQueries from './services/queries/upload';
import NonceTracker from './services/nonce-tracker';
import ReservedWords from './services/reserved-words';
import CardpaySDKService from './services/cardpay-sdk';
import WorkerClient from './services/worker-client';
import { Clock } from './services/clock';
import Web3HttpService from './services/web3-http';
import Web3SocketService from './services/web3-socket';
import boom from './tasks/boom';
import s3PutJson from './tasks/s3-put-json';
import RealmManager from './services/realm-manager';
import { serverLog, workerLog, botLog } from './utils/logger';

import CardBuilder from './services/card-builder';
import CardRoutes from './routes/card-routes';
import { CardCacheConfig } from './services/card-cache-config';
import CardCache from './services/card-cache';
import ExchangeRatesService from './services/exchange-rates';
import HubBot from './services/discord-bots/hub-bot';
import CardService from './services/card-service';
import HubDiscordBotsDbGateway from './services/discord-bots/discord-bots-db-gateway';
import HubDmChannelsDbGateway from './services/discord-bots/dm-channels-db-gateway';
import { SearchIndex } from './services/search-index';
import Web3Storage from './services/web3-storage';
import UploadRouter from './routes/upload';
import { ContractSubscriptionEventHandler } from './contract-subsciption-event-handler';
import NotifyMerchantClaimTask from './tasks/notify-merchant-claim';
import NotifyCustomerPaymentTask from './tasks/notify-customer-payment';
import SendNotificationsTask from './tasks/send-notifications';
import PushNotificationRegistrationSerializer from './services/serializers/push-notification-registration-serializer';
import PushNotificationRegistrationQueries from './services/queries/push-notification-registration';
import PushNotificationRegistrationsRoute from './routes/push_notification_registrations';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

export function createRegistry(): Registry {
  let registry = new Registry();
  registry.register('api-router', ApiRouter);
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('boom-route', BoomRoute);
  registry.register('callbacks-router', CallbacksRouter);
  registry.register('cardpay', CardpaySDKService);
  registry.register('clock', Clock);
  registry.register('contract-subscription-event-handler', ContractSubscriptionEventHandler);
  registry.register('custodial-wallet-route', CustodialWalletRoute);
  registry.register('database-manager', DatabaseManager);
  registry.register('development-config', DevelopmentConfig);
  registry.register('development-proxy-middleware', DevelopmentProxyMiddleware);
  registry.register('exchange-rates', ExchangeRatesService);
  registry.register('exchange-rates-route', ExchangeRatesRoute);
  registry.register('health-check', HealthCheck);
  registry.register('upload-router', UploadRouter);
  registry.register('upload', Upload);
  registry.register('upload-queries', UploadQueries);
  registry.register('hubServer', HubServer);
  registry.register('hub-discord-bots-db-gateway', HubDiscordBotsDbGateway);
  registry.register('hub-dm-channels-db-gateway', HubDmChannelsDbGateway);
  registry.register('inventory', InventoryService);
  registry.register('inventory-route', InventoryRoute);
  registry.register('merchant-infos-route', MerchantInfosRoute);
  registry.register('merchant-info-serializer', MerchantInfoSerializer);
  registry.register('merchant-info-queries', MerchantInfoQueries);
  registry.register('nonce-tracker', NonceTracker);
  registry.register('send-notifications', SendNotificationsTask);
  registry.register('notify-customer-payment', NotifyCustomerPaymentTask);
  registry.register('notify-merchant-claim', NotifyMerchantClaimTask);
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
  registry.register('push-notification-registrations-route', PushNotificationRegistrationsRoute);
  registry.register('push-notification-registration-serializer', PushNotificationRegistrationSerializer);
  registry.register('push-notification-registration-queries', PushNotificationRegistrationQueries);
  registry.register('relay', RelayService);
  registry.register('reserved-words', ReservedWords);
  registry.register('reservations-route', ReservationsRoute);
  registry.register('session-route', SessionRoute);
  registry.register('subgraph', SubgraphService);
  registry.register('wallet-connect', WalletConnectService);
  registry.register('worker-client', WorkerClient);
  registry.register('web3-http', Web3HttpService);
  registry.register('web3-socket', Web3SocketService);
  registry.register('wyre', WyreService);
  registry.register('wyre-callback-route', WyreCallbackRoute);
  registry.register('wyre-prices-route', WyrePricesRoute);
  registry.register('web3-storage', Web3Storage);

  if (process.env.COMPILER) {
    registry.register('card-service', CardService);
    registry.register('realm-manager', RealmManager);
    registry.register('card-cache-config', CardCacheConfig);
    registry.register('card-cache', CardCache);
    registry.register('card-routes', CardRoutes);
    registry.register(
      'card-routes-config',
      class {
        routeCard = config.has('compiler.routeCard') ? config.get('compiler.routeCard') : undefined;
      }
    );
    registry.register('card-builder', CardBuilder);
    registry.register('searchIndex', SearchIndex);
  }

  return registry;
}

export function createContainer(): Container {
  let registry = createRegistry();
  return new Container(registry);
}

export class HubServer {
  logger = serverLog;
  static logger = serverLog;

  private auth = inject('authentication-middleware', { as: 'auth' });
  private devProxy = inject('development-proxy-middleware', { as: 'devProxy' });
  private apiRouter = inject('api-router', { as: 'apiRouter' });
  private callbacksRouter = inject('callbacks-router', { as: 'callbacksRouter' });
  private cardRoutes: KnownServices['card-routes'] | undefined;
  private healthCheck = inject('health-check', { as: 'healthCheck' });
  private uploadRouter = inject('upload-router', { as: 'uploadRouter' });

  constructor() {
    initSentry();
  }

  async ready() {
    if (process.env.COMPILER) {
      this.cardRoutes = await getOwner(this).lookup('card-routes');
    }
  }

  @Memoize()
  get app(): Koa<Koa.DefaultState, Koa.Context> {
    let app = new Koa<Koa.DefaultState, Koa.Context>()
      .use(errorMiddleware)
      .use(environment)
      .use(cors({ origin: '*', allowHeaders: 'Authorization, Content-Type, If-Match, X-Requested-With' }))
      .use(httpLogging);

    app.use(this.auth.middleware());
    app.use(this.devProxy.middleware());
    app.use(this.apiRouter.routes());
    app.use(this.callbacksRouter.routes());
    app.use(this.uploadRouter.routes());

    if (this.cardRoutes) {
      app.use(this.cardRoutes.routes());
    }

    app.use(this.healthCheck.routes()); // Setup health-check at "/"
    app.on('error', this.onError.bind(this));
    return app;
  }

  private onError(err: Error, ctx: Koa.Context) {
    if ((err as any).intentionalTestError) {
      return;
    }
    this.logger.error(`Unhandled error:`, err);
    Sentry.withScope(function (scope) {
      scope.addEventProcessor(function (event) {
        return Sentry.Handlers.parseRequest(event, ctx.request);
      });
      Sentry.captureException(err);
    });
  }

  async listen(port = 3000) {
    let instance = this.app.listen(port);
    this.logger.info(`\n👂 Hub listening on %s\n`, port);

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
    let searchIndex = await getOwner(this).lookup('searchIndex');
    await searchIndex.indexAllRealms();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    hubServer: HubServer;
  }
}

export function initSentry() {
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
      'send-notifications': async (payload: any, helpers: Helpers) => {
        let task = await container.instantiate(SendNotificationsTask);
        return task.perform(payload, helpers);
      },
      'notify-merchant-claim': async (payload: any) => {
        let task = await container.instantiate(NotifyMerchantClaimTask);
        return task.perform(payload);
      },
      'notify-customer-payment': async (payload: any) => {
        let task = await container.instantiate(NotifyCustomerPaymentTask);
        return task.perform(payload);
      },
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

  // listen for contract events
  // internally this talks to the worker client
  await container.lookup('contract-subscription-event-handler');

  await runner.promise;
}

export class HubBotController {
  logger = botLog;
  static logger = botLog;

  static async create(serverConfig?: { registryCallback?: (r: Registry) => void }): Promise<HubBotController> {
    this.logger.info(`booting pid:${process.pid}`);
    initSentry();

    let registry = createRegistry();
    if (serverConfig?.registryCallback) {
      serverConfig.registryCallback(registry);
    }
    let container = new Container(registry);
    let bot: HubBot | undefined;

    try {
      bot = await container.instantiate(HubBot);
      await bot.start();
    } catch (e: any) {
      this.logger.error(`Unexpected error ${e.message}`, e);
      Sentry.withScope(function () {
        Sentry.captureException(e);
      });
    }

    if (!bot) {
      throw new Error('Bot could not be created');
    }
    this.logger.info(`started (${bot.type}:${bot.botInstanceId})`);

    return new this(bot, container);
  }

  private constructor(public bot: HubBot, public container: Container) {}

  async teardown() {
    this.logger.info('shutting down');
    await this.bot.destroy();
    await this.container.teardown();
  }
}
