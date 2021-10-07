import Router from '@koa/router';
import { RouterContext } from '@koa/router';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import { CardstackError } from '../utils/error';
import BoomRoute from '../routes/boom';
import ExchangeRatesRoute from '../routes/exchange-rates';
import SessionRoute from '../routes/session';
import PrepaidCardColorSchemesRoute from '../routes/prepaid-card-color-schemes';
import PrepaidCardPatternsRoute from '../routes/prepaid-card-patterns';
import PrepaidCardCustomizationsRoute from '../routes/prepaid-card-customizations';
import MerchantInfosRoute from '../routes/merchant-infos';
import ReservationsRoute from '../routes/reservations';
import OrdersRoute from '../routes/orders';
import InventoryRoute from '../routes/inventory';
import { inject } from '../di/dependency-injection';
import CustodialWalletRoute from '../routes/custodial-wallet';
import { parseBody } from '../middleware';

export default class APIRouter {
  boomRoute: BoomRoute = inject('boom-route', { as: 'boomRoute' });
  exchangeRatesRoute: ExchangeRatesRoute = inject('exchange-rates-route', { as: 'exchangeRatesRoute' });
  sessionRoute: SessionRoute = inject('session-route', { as: 'sessionRoute' });
  prepaidCardColorSchemesRoute: PrepaidCardColorSchemesRoute = inject('prepaid-card-color-schemes-route', {
    as: 'prepaidCardColorSchemesRoute',
  });
  prepaidCardPatternsRoute: PrepaidCardPatternsRoute = inject('prepaid-card-patterns-route', {
    as: 'prepaidCardPatternsRoute',
  });
  prepaidCardCustomizationsRoute: PrepaidCardCustomizationsRoute = inject('prepaid-card-customizations-route', {
    as: 'prepaidCardCustomizationsRoute',
  });
  merchantInfosRoute: MerchantInfosRoute = inject('merchant-infos-route', {
    as: 'merchantInfosRoute',
  });
  custodialWalletRoute: CustodialWalletRoute = inject('custodial-wallet-route', { as: 'custodialWalletRoute' });
  ordersRoute: OrdersRoute = inject('orders-route', { as: 'ordersRoute' });
  reservationsRoute: ReservationsRoute = inject('reservations-route', { as: 'reservationsRoute' });
  inventoryRoute: InventoryRoute = inject('inventory-route', { as: 'inventoryRoute' });
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
declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'api-router': APIRouter;
  }
}
