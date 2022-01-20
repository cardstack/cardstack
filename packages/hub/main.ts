/* eslint-disable no-process-exit */
// make sure the side-effect of `import 'load-dotenv'` happens before config is
// imported. since imports are statically resolved, using dotenv.config() before
// the import config, will not actually mean that dotenv.config() is called
// before the config is imported.
import './load-dotenv';
import config from 'config';

import Koa from 'koa';
import { environment, httpLogging, errorMiddleware } from './middleware';
import cors from '@koa/cors';
import fetch from 'node-fetch';
import * as Sentry from '@sentry/node';
import { Memoize } from 'typescript-memoize';

import logger from '@cardstack/logger';
import { Registry, Container, inject, getOwner, KnownServices } from '@cardstack/di';

import initSentry from './initializers/sentry';
import initFirebase from './initializers/firebase';

import DatabaseManager from '@cardstack/db';

import { AuthenticationUtils } from './utils/authentication';
import CardpaySDKService from './services/cardpay-sdk';
import { Clock } from './services/clock';

import CardSpaceQueries from './services/queries/card-space';
import CardSpaceValidator from './services/validators/card-space';
import HubDiscordBotsDbGateway from './services/discord-bots/discord-bots-db-gateway';
import HubDmChannelsDbGateway from './services/discord-bots/dm-channels-db-gateway';
import LatestEventBlockQueries from './services/queries/latest-event-block';
import MerchantInfoQueries from './services/queries/merchant-info';
import NotificationPreferenceQueries from './services/queries/notification-preference';
import NotificationPreferenceService from './services/push-notifications/preferences';
import NotificationTypeQueries from './services/queries/notification-type';
import PushNotificationRegistrationQueries from './services/queries/push-notification-registration';
import SentPushNotificationsQueries from './services/queries/sent-push-notifications';
import Upload from './routes/upload';
import UploadQueries from './services/queries/upload';
import UploadRouter from './routes/upload';
import { ContractSubscriptionEventHandler } from './services/contract-subscription-event-handler';
import { HubWorker } from './worker';
import HubBot from './services/discord-bots/hub-bot';

import NotifyCustomerPaymentTask from './tasks/notify-customer-payment';
import NotifyMerchantClaimTask from './tasks/notify-merchant-claim';
import PersistOffChainCardSpaceTask from './tasks/persist-off-chain-card-space';
import PersistOffChainMerchantInfoTask from './tasks/persist-off-chain-merchant-info';
import PersistOffChainPrepaidCardCustomizationTask from './tasks/persist-off-chain-prepaid-card-customization';
import RemoveOldSentNotificationsTask from './tasks/remove-old-sent-notifications';
import SendNotificationsTask from './tasks/send-notifications';

import OrderService from './services/order';

import InventoryService from './services/inventory';

//@ts-ignore polyfilling fetch
global.fetch = fetch;

const serverLog = logger('hub/server');

export function createRegistry(): Registry {
  let registry = new Registry({
    rootDir: process.cwd(),
    importConfig: [{ type: 'service', prefixOptional: true }, { type: 'route' }],
    importFactory: async (type, importPath) => {
      switch (type) {
        case 'service':
          return await import(
            /* webpackExclude: /assets/ */
            `./services/${importPath.replace('./services/', '')}`
          );
        case 'route':
          return await import(`./routes/${importPath.replace('./routes/', '')}`);

        default:
          throw new Error(`Received an import type of ${type} that didnt receive an import config`);
      }
      // if (importPath.startsWith('./routes/')) {
      //   return await import(`./routes/${importPath.replace('./routes/', '')}`);
      // }
    },
  });

  registry.register('hubServer', HubServer);
  registry.register('hubWorker', HubWorker);
  registry.register('hubBot', HubBot);

  registry.register('authentication-utils', AuthenticationUtils);
  registry.register('cardpay', CardpaySDKService);
  registry.register('clock', Clock);
  registry.register('database-manager', DatabaseManager);
  registry.register('upload-router', UploadRouter);
  registry.register('upload', Upload);
  registry.register('upload-queries', UploadQueries);
  registry.register('hub-discord-bots-db-gateway', HubDiscordBotsDbGateway);
  registry.register('hub-dm-channels-db-gateway', HubDmChannelsDbGateway);
  registry.register('inventory', InventoryService);
  registry.register('latest-event-block-queries', LatestEventBlockQueries);
  registry.register('merchant-info-queries', MerchantInfoQueries);
  registry.register('send-notifications', SendNotificationsTask);
  registry.register('notify-customer-payment', NotifyCustomerPaymentTask);
  registry.register('notify-merchant-claim', NotifyMerchantClaimTask);
  registry.register('order', OrderService);
  registry.register('persist-off-chain-prepaid-card-customization', PersistOffChainPrepaidCardCustomizationTask);
  registry.register('persist-off-chain-merchant-info', PersistOffChainMerchantInfoTask);
  registry.register('persist-off-chain-card-space', PersistOffChainCardSpaceTask);
  registry.register('card-space-validator', CardSpaceValidator);
  registry.register('card-space-queries', CardSpaceQueries);
  registry.register('push-notification-registration-queries', PushNotificationRegistrationQueries);
  registry.register('notification-type-queries', NotificationTypeQueries);
  registry.register('notification-preference-queries', NotificationPreferenceQueries);
  registry.register('notification-preference-service', NotificationPreferenceService);
  registry.register('contract-subscription-event-handler', ContractSubscriptionEventHandler);
  registry.register('remove-old-sent-notifications', RemoveOldSentNotificationsTask);
  registry.register('sent-push-notifications-queries', SentPushNotificationsQueries);

  if (process.env.COMPILER) {
    registry.register(
      'card-routes-config',
      class {
        routeCard = config.has('compiler.routeCard') ? config.get('compiler.routeCard') : undefined;
      }
    );
  }

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
  private cardRoutes: KnownServices['route:cards'] | undefined;
  private healthCheck = inject('health-check', { as: 'healthCheck' });
  private uploadRouter = inject('upload-router', { as: 'uploadRouter' });

  constructor() {
    runInitializers();
  }

  async ready() {
    if (process.env.COMPILER) {
      this.cardRoutes = await getOwner(this).lookup('route:cards');
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
    let searchIndex = await getOwner(this).lookup('searchIndex');
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
