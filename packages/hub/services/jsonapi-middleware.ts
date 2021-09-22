import compose from 'koa-compose';
import route from 'koa-better-route';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import KoaBody from 'koa-body';
import { Memoize } from 'typescript-memoize';
import { CardstackError } from '../utils/error';
import { SessionContext } from './authentication-middleware';
import BoomRoute from '../routes/boom';
import SessionRoute from '../routes/session';
import PrepaidCardColorSchemesRoute from '../routes/prepaid-card-color-schemes';
import PrepaidCardPatternsRoute from '../routes/prepaid-card-patterns';
import PrepaidCardCustomizationsRoute from '../routes/prepaid-card-customizations';
import MerchantInfosRoute from '../routes/merchant-infos';
import { inject } from '../di/dependency-injection';
import CustodialWalletRoute from '../routes/custodial-wallet';
import ReservationsRoute from '../routes/reservations';
import OrdersRoute from '../routes/orders';
import InventoryRoute from '../routes/inventory';

const API_PREFIX = '/api';
const apiPrefixPattern = new RegExp(`^${API_PREFIX}/(.*)`);

export default class JSONAPIMiddleware {
  boomRoute: BoomRoute = inject('boom-route', { as: 'boomRoute' });
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
  middleware() {
    return (ctxt: Koa.ParameterizedContext<SessionContext, Record<string, unknown>>, next: Koa.Next) => {
      let m = apiPrefixPattern.exec(ctxt.request.path);
      if (!m) {
        return next();
      }
      ctxt.request.path = `/${m[1]}`;

      if (this.isJSONAPI(ctxt)) {
        return this.jsonHandlers(ctxt, next);
      } else {
        throw new CardstackError(`Only JSON-API requests are supported at this endpoint`);
      }
    };
  }

  @Memoize()
  get jsonHandlers() {
    let body = KoaBody({
      jsonLimit: '16mb',
      multipart: false,
      urlencoded: false,
      text: false,
      jsonStrict: true,
      onError(error: Error) {
        throw new CardstackError(`error while parsing body: ${error.message}`, { status: 400 });
      },
    });
    let {
      boomRoute,
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

    return compose([
      CardstackError.withJsonErrorHandling,
      body,
      route.get('/boom', boomRoute.get),
      route.get('/custodial-wallet', custodialWalletRoute.get),
      route.get('/inventories', inventoryRoute.get),
      route.post('/merchant-infos', merchantInfosRoute.post),
      route.get('/merchant-infos/validate-slug/:slug', merchantInfosRoute.getValidation),
      route.post('/orders', ordersRoute.post),
      route.get('/orders/:order_id', ordersRoute.get),
      route.get('/prepaid-card-color-schemes', prepaidCardColorSchemesRoute.get),
      route.get('/prepaid-card-patterns', prepaidCardPatternsRoute.get),
      route.post('/reservations', reservationsRoute.post),
      route.get('/reservations/:reservation_id', reservationsRoute.get),
      route.post('/prepaid-card-customizations', prepaidCardCustomizationsRoute.post),
      route.get('/session', sessionRoute.get),
      route.post('/session', sessionRoute.post),
      route.all('/(.*)', notFound),
    ]);
  }

  isJSONAPI(ctxt: Koa.ParameterizedContext<SessionContext, Record<string, unknown>>) {
    let contentType = ctxt.request.headers['content-type'];
    let isJsonApi = contentType && contentType.includes('application/vnd.api+json');
    let [acceptedTypes]: string[] = (ctxt.request.headers['accept'] || '').split(';');
    let types = acceptedTypes.split(',');
    let acceptsJsonApi = types.some((t) => mimeMatch(t, 'application/vnd.api+json'));
    return isJsonApi || acceptsJsonApi;
  }
}

function notFound(ctx: Koa.Context) {
  ctx.status = 404;
}
declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'jsonapi-middleware': JSONAPIMiddleware;
  }
}
