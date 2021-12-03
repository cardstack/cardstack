import Router from '@koa/router';
import { RouterContext } from '@koa/router';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import { CardstackError } from '@cardstack/core/src/utils/errors';
import { inject } from '@cardstack/di';
import { parseBody } from '../middleware';

export default class APIRouter {
  boomRoute = inject('boom-route', { as: 'boomRoute' });
  exchangeRatesRoute = inject('exchange-rates-route', { as: 'exchangeRatesRoute' });
  sessionRoute = inject('session-route', { as: 'sessionRoute' });
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
  cardSpacesRoute = inject('card-spaces-route', {
    as: 'cardSpacesRoute',
  });
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
  routes() {
    let {
      boomRoute,
      exchangeRatesRoute,
      prepaidCardColorSchemesRoute,
      prepaidCardPatternsRoute,
      prepaidCardCustomizationsRoute,
      merchantInfosRoute,
      custodialWalletRoute,
      sessionRoute,
      ordersRoute,
      reservationsRoute,
      inventoryRoute,
      cardSpacesRoute,
      wyrePricesRoute,
      pushNotificationRegistrationsRoute,
      notificationPreferencesRoute,
    } = this;
    let apiSubrouter = new Router();
    apiSubrouter.get('/boom', boomRoute.get);
    apiSubrouter.get('/exchange-rates', exchangeRatesRoute.get);
    apiSubrouter.get('/session', sessionRoute.get);
    apiSubrouter.post('/session', parseBody, sessionRoute.post);
    apiSubrouter.get('/prepaid-card-color-schemes', prepaidCardColorSchemesRoute.get);
    apiSubrouter.get('/prepaid-card-patterns', prepaidCardPatternsRoute.get);
    apiSubrouter.post('/prepaid-card-customizations', parseBody, prepaidCardCustomizationsRoute.post);
    apiSubrouter.post('/merchant-infos', parseBody, merchantInfosRoute.post);
    apiSubrouter.get('/merchant-infos/validate-slug/:slug', merchantInfosRoute.getValidation);
    apiSubrouter.get('/custodial-wallet', custodialWalletRoute.get);
    apiSubrouter.get('/inventories', inventoryRoute.get);
    apiSubrouter.post('/orders', parseBody, ordersRoute.post);
    apiSubrouter.get('/orders/:order_id', ordersRoute.get);
    apiSubrouter.post('/reservations', parseBody, reservationsRoute.post);
    apiSubrouter.get('/reservations/:reservation_id', reservationsRoute.get);
    apiSubrouter.post('/card-spaces', parseBody, cardSpacesRoute.post);
    apiSubrouter.post('/card-spaces/validate-profile-name', parseBody, cardSpacesRoute.postProfileNameValidation);
    apiSubrouter.post('/card-spaces/validate-url', parseBody, cardSpacesRoute.postUrlValidation);
    apiSubrouter.put('/card-spaces/:id', parseBody, cardSpacesRoute.put);
    apiSubrouter.post('/push-notification-registrations', parseBody, pushNotificationRegistrationsRoute.post);
    apiSubrouter.delete(
      '/push-notification-registrations/:push_client_id',
      parseBody,
      pushNotificationRegistrationsRoute.delete
    );
    apiSubrouter.get('/notification-preferences/:push_client_id', parseBody, notificationPreferencesRoute.get);
    apiSubrouter.post('/notification-preferences', parseBody, notificationPreferencesRoute.post);
    apiSubrouter.get('/wyre-prices', parseBody, wyrePricesRoute.get);
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
