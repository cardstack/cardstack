import Router from '@koa/router';
import { RouterContext } from '@koa/router';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import { CardstackError } from '@cardstack/core/src/utils/errors';
import { inject } from '@cardstack/di';
import { parseBody, reportDeprecatedRouteUsage } from '../middleware';
import { route } from '@cardstack/hub/routes';

export default class APIRouter {
  boomRoute = inject('boom-route', { as: 'boomRoute' });
  config = route('config');
  exchangeRatesRoute = inject('exchange-rates-route', { as: 'exchangeRatesRoute' });
  sessionRoute = inject('session-route', { as: 'sessionRoute' });
  status = route('status');
  prepaidCardColorSchemesRoute = inject('prepaid-card-color-schemes-route', {
    as: 'prepaidCardColorSchemesRoute',
  });
  prepaidCardPatternsRoute = inject('prepaid-card-patterns-route', {
    as: 'prepaidCardPatternsRoute',
  });
  prepaidCardCustomizationsRoute = inject('prepaid-card-customizations-route', {
    as: 'prepaidCardCustomizationsRoute',
  });
  merchantInfosRoute = inject('merchant-infos-route', {
    as: 'merchantInfosRoute',
  });
  profilesRoute = inject('profiles-route', {
    as: 'profilesRoute',
  });
  emailCardDropRequestsRoute = inject('email-card-drop-requests-route', {
    as: 'emailCardDropRequestsRoute',
  });
  jobTicketsRoute = inject('job-tickets-route', { as: 'jobTicketsRoute' });
  profilePurchasesRoute = inject('profile-purchases-route', { as: 'profilePurchasesRoute' });
  pushNotificationRegistrationsRoute = inject('push-notification-registrations-route', {
    as: 'pushNotificationRegistrationsRoute',
  });
  notificationPreferencesRoute = inject('notification-preferences-route', {
    as: 'notificationPreferencesRoute',
  });
  custodialWalletRoute = inject('custodial-wallet-route', { as: 'custodialWalletRoute' });
  ordersRoute = inject('orders-route', { as: 'ordersRoute' });
  reservationsRoute = inject('reservations-route', { as: 'reservationsRoute' });
  inventoryRoute = inject('inventory-route', { as: 'inventoryRoute' });
  wyrePricesRoute = inject('wyre-prices-route', { as: 'wyrePricesRoute' });
  scheduledPaymentsRoute = inject('scheduled-payments-route', { as: 'scheduledPaymentsRoute' });
  scheduledPaymentAttemptsRoute = inject('scheduled-payment-attempts-route', { as: 'scheduledPaymentAttemptsRoute' });
  dataIntegrityChecksRoute = inject('data-integrity-checks-route', {
    as: 'dataIntegrityChecksRoute',
  });
  gasStationRoute = inject('gas-station-route', { as: 'gasStationRoute' });
  gasEstimationRoute = inject('gas-estimation-route', { as: 'gasEstimationRoute' });

  routes() {
    let {
      boomRoute,
      config: configRoute,
      exchangeRatesRoute,
      prepaidCardColorSchemesRoute,
      prepaidCardPatternsRoute,
      prepaidCardCustomizationsRoute,
      merchantInfosRoute,
      profilesRoute,
      custodialWalletRoute,
      sessionRoute,
      status: statusRoute,
      ordersRoute,
      reservationsRoute,
      inventoryRoute,
      emailCardDropRequestsRoute,
      jobTicketsRoute,
      wyrePricesRoute,
      pushNotificationRegistrationsRoute,
      notificationPreferencesRoute,
      scheduledPaymentsRoute,
      scheduledPaymentAttemptsRoute,
      dataIntegrityChecksRoute,
      gasStationRoute,
      gasEstimationRoute,
    } = this;
    let apiSubrouter = new Router();
    apiSubrouter.get('/boom', boomRoute.get);
    apiSubrouter.get('/config', configRoute.get);
    apiSubrouter.get('/exchange-rates', exchangeRatesRoute.get);
    apiSubrouter.get('/session', sessionRoute.get);
    apiSubrouter.post('/session', parseBody, sessionRoute.post);
    apiSubrouter.get('/status', statusRoute.get);
    apiSubrouter.get('/prepaid-card-color-schemes', prepaidCardColorSchemesRoute.get);
    apiSubrouter.get('/prepaid-card-patterns', prepaidCardPatternsRoute.get);
    apiSubrouter.post('/prepaid-card-customizations', parseBody, prepaidCardCustomizationsRoute.post);

    apiSubrouter.post(
      '/merchant-infos',
      reportDeprecatedRouteUsage({ alert: 'web-team' }),
      parseBody,
      merchantInfosRoute.post
    );
    apiSubrouter.get(
      '/merchant-infos/validate-slug/:slug',
      reportDeprecatedRouteUsage({ alert: 'web-team' }),
      merchantInfosRoute.getValidation
    );
    apiSubrouter.get(
      '/merchant-infos',
      reportDeprecatedRouteUsage({ alert: 'web-team' }),
      parseBody,
      merchantInfosRoute.get
    );
    apiSubrouter.get(
      '/merchant-infos/short-id/:id',
      reportDeprecatedRouteUsage({ alert: 'web-team' }),
      parseBody,
      merchantInfosRoute.getFromShortId
    );

    apiSubrouter.post('/profiles', parseBody, profilesRoute.post);
    apiSubrouter.get('/profiles/validate-slug/:slug', profilesRoute.getValidation);
    apiSubrouter.get('/profiles', parseBody, profilesRoute.list);
    apiSubrouter.get('/profiles/:slug', profilesRoute.get);
    apiSubrouter.patch('/profiles/:id', parseBody, profilesRoute.patch);
    apiSubrouter.get('/profiles/short-id/:id', parseBody, profilesRoute.getFromShortId);

    apiSubrouter.get('/custodial-wallet', custodialWalletRoute.get);
    apiSubrouter.get('/inventories', inventoryRoute.get);
    apiSubrouter.post('/orders', parseBody, ordersRoute.post);
    apiSubrouter.get('/orders/:order_id', ordersRoute.get);
    apiSubrouter.post('/reservations', parseBody, reservationsRoute.post);
    apiSubrouter.get('/reservations/:reservation_id', reservationsRoute.get);

    apiSubrouter.get('/email-card-drop-requests', emailCardDropRequestsRoute.get);
    apiSubrouter.post('/email-card-drop-requests', parseBody, emailCardDropRequestsRoute.post);

    apiSubrouter.get('/job-tickets', jobTicketsRoute.list);
    apiSubrouter.get('/job-tickets/:id', jobTicketsRoute.get);
    apiSubrouter.post('/job-tickets/:id/retry', jobTicketsRoute.retry);

    apiSubrouter.post('/profile-purchases', parseBody, this.profilePurchasesRoute.post);

    apiSubrouter.post('/push-notification-registrations', parseBody, pushNotificationRegistrationsRoute.post);
    apiSubrouter.delete(
      '/push-notification-registrations/:push_client_id',
      parseBody,
      pushNotificationRegistrationsRoute.delete
    );
    apiSubrouter.get('/notification-preferences/:push_client_id', parseBody, notificationPreferencesRoute.get);
    apiSubrouter.put('/notification-preferences/:push_client_id', parseBody, notificationPreferencesRoute.put);
    apiSubrouter.post('/scheduled-payments', parseBody, scheduledPaymentsRoute.post);
    apiSubrouter.get('/scheduled-payments/:scheduled_payment_id', parseBody, scheduledPaymentsRoute.get);
    apiSubrouter.get('/scheduled-payments', parseBody, scheduledPaymentsRoute.list);
    apiSubrouter.patch('/scheduled-payments/:scheduled_payment_id', parseBody, scheduledPaymentsRoute.patch);
    apiSubrouter.delete('/scheduled-payments/:scheduled_payment_id', parseBody, scheduledPaymentsRoute.delete);
    apiSubrouter.get('/scheduled-payment-attempts', parseBody, scheduledPaymentAttemptsRoute.list);
    apiSubrouter.get('/wyre-prices', parseBody, wyrePricesRoute.get);
    apiSubrouter.get('/data-integrity-checks/:check_name', parseBody, dataIntegrityChecksRoute.get);
    apiSubrouter.get('/gas-station/:chain_id', gasStationRoute.get);
    apiSubrouter.post('/gas-estimation', parseBody, gasEstimationRoute.get);
    apiSubrouter.all('/(.*)', notFound);

    let apiRouter = new Router();
    apiRouter.use('/api', verifyJSONAPI, apiSubrouter.routes(), apiSubrouter.allowedMethods());
    return apiRouter.routes();
  }
}

// TODO: the type for ctxt should be narrowed!
function verifyJSONAPI(ctxt: RouterContext<any, any>, next: Koa.Next) {
  let contentType = ctxt.request.headers['content-type'];
  let isJsonApi = contentType && contentType.includes('application/vnd.api+json');
  let [acceptedTypes]: string[] = (ctxt.request.headers['accept'] || '').split(';');
  let types = acceptedTypes.split(',');
  let acceptsJsonApi = types.some((t) => mimeMatch(t, 'application/vnd.api+json'));
  if (isJsonApi || acceptsJsonApi) {
    return next();
  } else {
    throw new CardstackError(`Only JSON-API requests are supported at this endpoint`);
  }
}

function notFound(ctx: Koa.Context) {
  ctx.status = 404;
}
declare module '@cardstack/di' {
  interface KnownServices {
    'api-router': APIRouter;
  }
}
