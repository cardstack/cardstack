/* eslint-disable no-process-exit */
// make sure the side-effect of `import 'load-dotenv'` happens before config is
// imported. since imports are statically resolved, using dotenv.config() before
// the import config, will not actually mean that dotenv.config() is called
// before the config is imported.
import './load-dotenv';
import config from 'config';

import Koa from 'koa';
import { httpLogging, errorMiddleware } from './middleware';
import cors from '@koa/cors';
import fetch from 'node-fetch';
import * as Sentry from '@sentry/node';
import { Memoize } from 'typescript-memoize';

import logger from '@cardstack/logger';
import { Registry, Container, inject, getOwner } from '@cardstack/di';
import { service } from '@cardstack/hub/services';

import initSentry from './initializers/sentry';
import initFirebase from './initializers/firebase';

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
import SubgraphService from './services/subgraph';
import OrderService from './services/order';
import InventoryService from './services/inventory';
import MerchantInfosRoute from './routes/merchant-infos';
import CustodialWalletRoute from './routes/custodial-wallet';
import WyreCallbackRoute from './routes/wyre-callback';
import WyrePricesRoute from './routes/wyre-prices';
import MerchantInfoService from './services/merchant-info';
import ProfileValidator from './services/validators/profile';
import { AuthenticationUtils } from './utils/authentication';
import ApiRouter from './services/api-router';
import CallbacksRouter from './services/callbacks-router';
import Upload from './routes/upload';
import NonceTracker from './services/nonce-tracker';
import ReservedWords from './services/reserved-words';
import CardpaySDKService from './services/cardpay-sdk';
import WorkerClient from './services/worker-client';
import { Clock } from './services/clock';
import Web3HttpService from './services/web3-http';
import Web3SocketService from './services/web3-socket';
import ExchangeRatesService from './services/exchange-rates';
import HubDiscordBotsDbGateway from './services/discord-bots/discord-bots-db-gateway';
import HubDmChannelsDbGateway from './services/discord-bots/dm-channels-db-gateway';
import Web3Storage from './services/web3-storage';
import UploadRouter from './routes/upload';
import PushNotificationRegistrationSerializer from './services/serializers/push-notification-registration-serializer';
import PushNotificationRegistrationsRoute from './routes/push-notification-registrations';
import FirebasePushNotifications from './services/push-notifications/firebase';
import Contracts from './services/contracts';
import NotificationPreferenceSerializer from './services/serializers/notification-preference-serializer';
import NotificationPreferencesRoute from './routes/notification-preferences';
import NotificationPreferenceService from './services/push-notifications/preferences';
import { ContractSubscriptionEventHandler } from './services/contract-subscription-event-handler';
import { HubWorker } from './worker';
import HubBot from './services/discord-bots/hub-bot';
import PagerdutyApi from './services/pagerduty-api';
import StatuspageApi from './services/statuspage-api';
import ChecklyWebhookRoute from './routes/checkly-webhook';
import PagerdutyIncidentsWebhookRoute from './routes/pagerduty-incidents-webhook';
import { KnownRoutes, registerRoutes } from '@cardstack/hub/routes';
import { registerServices } from '@cardstack/hub/services';
import EmailCardDropRouter from './services/email-card-drop-router';
import EmailCardDropRequestsRoute from './routes/email-card-drop-requests';
import EmailCardDropRequestSerializer from './services/serializers/email-card-drop-request-serializer';
import InAppPurchases from './services/in-app-purchases';
import JobTicketsRoute from './routes/job-tickets';
import JobTicketSerializer from './services/serializers/job-ticket-serializer';
import ProfilePurchasesRoute from './routes/profile-purchases';
import ProfilesRoute from './routes/profiles';
import ProfileSerializer from './services/serializers/profile-serializer';
import Email from './services/email';
import Mailchimp from './services/mailchimp';
import PrismaManager from './services/prisma-manager';
import ScheduledPaymentsFetcherService from './services/scheduled-payments/fetcher';
import ScheduledPaymentSerializer from './services/serializers/scheduled-payment-serializer';
import ScheduledPaymentValidator from './services/validators/scheduled-payment';
import ScheduledPaymentsRoute from './routes/scheduled-payments';
import ScheduledPaymentsExecutorService from './services/scheduled-payments/executor';
import EthersProvider from './services/ethers-provider';
import CrankNonceLock from './services/crank-nonce-lock';
import DataIntegrityChecksScheduledPayments from './services/data-integrity-checks/scheduled-payments';
import DataIntegrityChecksRoute from './routes/data-integrity-checks';
import GasStationService from './services/gas-station';
import GasStationRoute from './routes/gas-station';
import GasEstimationRoute from './routes/gas-estimation';
import GasEstimationService from './services/gas-estimation';
import GasEstimationValidator from './services/validators/gas-estimation';
import GasEstimationResultSerializer from './services/serializers/gas-estimation-result-serializer';
import ScheduledPaymentsAttemptsRoute from './routes/scheduled-payment-attempts';
import ScheduledPaymentAttemptSerializer from './services/serializers/scheduled-payment-attempt-serializer';
import GasPriceSerializer from './services/serializers/gas-price-serializer';
import RewardProofsRoute from './routes/reward-proofs';
import DataIntegrityChecksCronTasks from './services/data-integrity-checks/cron-tasks';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

const serverLog = logger('hub/server');

export function createRegistry(): Registry {
  let registry = new Registry();
  registry.register('hubServer', HubServer);
  registry.register('hubWorker', HubWorker);
  registry.register('hubBot', HubBot);

  registry.register('api-router', ApiRouter);
  registry.register('authentication-middleware', AuthenticationMiddleware);
  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('boom-route', BoomRoute);
  registry.register('callbacks-router', CallbacksRouter);
  registry.register('cardpay', CardpaySDKService);
  registry.register('clock', Clock);
  registry.register('contracts', Contracts);
  registry.register('custodial-wallet-route', CustodialWalletRoute);
  registry.register('database-manager', DatabaseManager);
  registry.register('development-config', DevelopmentConfig);
  registry.register('development-proxy-middleware', DevelopmentProxyMiddleware);
  registry.register('exchange-rates', ExchangeRatesService);
  registry.register('exchange-rates-route', ExchangeRatesRoute);
  registry.register('upload-router', UploadRouter);
  registry.register('upload', Upload);
  registry.register('hub-discord-bots-db-gateway', HubDiscordBotsDbGateway);
  registry.register('hub-dm-channels-db-gateway', HubDmChannelsDbGateway);
  registry.register('in-app-purchases', InAppPurchases);
  registry.register('inventory', InventoryService);
  registry.register('inventory-route', InventoryRoute);
  registry.register('merchant-infos-route', MerchantInfosRoute);
  registry.register('merchant-info', MerchantInfoService);
  registry.register('nonce-tracker', NonceTracker);
  registry.register('email', Email);
  registry.register('mailchimp', Mailchimp);
  registry.register('order', OrderService);
  registry.register('orders-route', OrdersRoute);
  registry.register('prepaid-card-customizations-route', PrepaidCardCustomizationsRoute);
  registry.register('prepaid-card-customization-serializer', PrepaidCardCustomizationSerializer);
  registry.register('prepaid-card-color-schemes-route', PrepaidCardColorSchemesRoute);
  registry.register('prepaid-card-color-scheme-serializer', PrepaidCardColorSchemeSerializer);
  registry.register('prepaid-card-patterns-route', PrepaidCardPatternsRoute);
  registry.register('prepaid-card-pattern-serializer', PrepaidCardPatternSerializer);
  registry.register('email-card-drop-request-serializer', EmailCardDropRequestSerializer);
  registry.register('email-card-drop-requests-route', EmailCardDropRequestsRoute);
  registry.register('job-tickets-route', JobTicketsRoute);
  registry.register('job-ticket-serializer', JobTicketSerializer);
  registry.register('profile-purchases-route', ProfilePurchasesRoute);
  registry.register('profiles-route', ProfilesRoute);
  registry.register('profile-serializer', ProfileSerializer);
  registry.register('profile-validator', ProfileValidator);
  registry.register('push-notification-registrations-route', PushNotificationRegistrationsRoute);
  registry.register('push-notification-registration-serializer', PushNotificationRegistrationSerializer);
  registry.register('firebase-push-notifications', FirebasePushNotifications);
  registry.register('notification-preferences-route', NotificationPreferencesRoute);
  registry.register('notification-preference-serializer', NotificationPreferenceSerializer);
  registry.register('notification-preference-service', NotificationPreferenceService);
  registry.register('contract-subscription-event-handler', ContractSubscriptionEventHandler);
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
  registry.register('pagerduty-api', PagerdutyApi);
  registry.register('statuspage-api', StatuspageApi);
  registry.register('checkly-webhook-route', ChecklyWebhookRoute);
  registry.register('pagerduty-incidents-webhook-route', PagerdutyIncidentsWebhookRoute);
  registry.register('email-card-drop-router', EmailCardDropRouter);
  registry.register('prisma-manager', PrismaManager);
  registry.register('scheduled-payment-fetcher', ScheduledPaymentsFetcherService);
  registry.register('scheduled-payment-executor', ScheduledPaymentsExecutorService);
  registry.register('scheduled-payment-serializer', ScheduledPaymentSerializer);
  registry.register('scheduled-payment-validator', ScheduledPaymentValidator);
  registry.register('scheduled-payments-route', ScheduledPaymentsRoute);
  registry.register('scheduled-payment-attempts-route', ScheduledPaymentsAttemptsRoute);
  registry.register('scheduled-payment-attempt-serializer', ScheduledPaymentAttemptSerializer);
  registry.register('crank-nonce-lock', CrankNonceLock);
  registry.register('ethers-provider', EthersProvider);
  registry.register('data-integrity-checks-scheduled-payments', DataIntegrityChecksScheduledPayments);
  registry.register('data-integrity-checks-cron-tasks', DataIntegrityChecksCronTasks);
  registry.register('data-integrity-checks-route', DataIntegrityChecksRoute);
  registry.register('gas-station-service', GasStationService);
  registry.register('gas-station-route', GasStationRoute);
  registry.register('gas-price-serializer', GasPriceSerializer);
  registry.register('gas-estimation-route', GasEstimationRoute);
  registry.register('gas-estimation-service', GasEstimationService);
  registry.register('gas-estimation-validator', GasEstimationValidator);
  registry.register('gas-estimation-result-serializer', GasEstimationResultSerializer);
  registry.register('reward-proofs-route', RewardProofsRoute);

  if (process.env.COMPILER) {
    registry.register(
      'card-routes-config',
      class {
        routeCard = config.has('compiler.routeCard') ? config.get('compiler.routeCard') : undefined;
      },
      { type: 'service' }
    );
  }

  registerServices(registry);
  registerRoutes(registry);

  return registry;
}

export function createContainer(): Container {
  let registry = createRegistry();
  return new Container(registry);
}

export class HubServer {
  private auth = inject('authentication-middleware', { as: 'auth' });
  private devProxy = inject('development-proxy-middleware', { as: 'devProxy' });
  private apiRouter = inject('api-router', { as: 'apiRouter' });
  private callbacksRouter = inject('callbacks-router', { as: 'callbacksRouter' });
  private emailCardDropRouter = inject('email-card-drop-router', { as: 'emailCardDropRouter' });
  private healthCheck = service('health-check', { as: 'healthCheck' });
  private uploadRouter = inject('upload-router', { as: 'uploadRouter' });
  private cardRoutes: KnownRoutes['card-routes'] | undefined;

  constructor() {
    runInitializers();
  }

  async ready() {
    if (process.env.COMPILER) {
      this.cardRoutes = await getOwner(this).lookup('card-routes', { type: 'route' });
    }
  }

  @Memoize()
  get app(): Koa<Koa.DefaultState, Koa.Context> {
    let app = new Koa<Koa.DefaultState, Koa.Context>()
      .use(errorMiddleware)
      .use(cors({ origin: '*', allowHeaders: 'Authorization, Content-Type, If-Match, X-Requested-With' }))
      .use(httpLogging);

    app.use(this.auth.middleware());
    app.use(this.devProxy.middleware());
    app.use(this.apiRouter.routes());
    app.use(this.callbacksRouter.routes());
    app.use(this.emailCardDropRouter.routes());
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
    serverLog.error(`Unhandled error:`, err);
    Sentry.withScope(function (scope) {
      scope.addEventProcessor(function (event) {
        return Sentry.Handlers.parseRequest(event, ctx.request);
      });
      Sentry.captureException(err);
    });
  }

  async listen(port = 3000) {
    let instance = this.app.listen(port);
    serverLog.info(`\n👂 Hub listening on %s\n`, port);

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
    let searchIndex = await getOwner(this).lookup('searchIndex', { type: 'service' });
    await searchIndex.indexAllRealms();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    hubServer: HubServer;
  }
}

export function runInitializers() {
  initSentry();
  initFirebase();
}
