import Router from '@koa/router';
import { RouterContext } from '@koa/router';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import { CardstackError } from '../utils/error';
import { inject } from '@cardstack/di';
import WyreCallbackRoute from '../routes/wyre-callback';
import { parseBody } from '../middleware';

export default class CallbacksRouter {
  wyreCallbackRoute: WyreCallbackRoute = inject('wyre-callback-route', { as: 'wyreCallbackRoute' });
  routes() {
    let { wyreCallbackRoute } = this;
    let callbacksSubrouter = new Router();
    callbacksSubrouter.post('/wyre', parseBody, wyreCallbackRoute.post);
    callbacksSubrouter.all('/(.*)', notFound);

    let callbacksRouter = new Router();
    callbacksRouter.use('/callbacks', verifyIsJSON, callbacksSubrouter.routes(), callbacksSubrouter.allowedMethods());
    return callbacksRouter.routes();
  }
}

// TODO: the type for ctxt should be narrowed!
function verifyIsJSON(ctxt: RouterContext<any, any>, next: Koa.Next) {
  let contentType = ctxt.request.headers['content-type'];
  let isJson = contentType && contentType.includes('application/json');
  let [acceptedTypes]: string[] = (ctxt.request.headers['accept'] || '').split(';');
  let types = acceptedTypes.split(',');
  let acceptsJson = types.some((t) => mimeMatch(t, 'application/json'));
  if (isJson || acceptsJson) {
    return next();
  } else {
    throw new CardstackError(`Only "application/json" requests are supported at this endpoint`);
  }
}

function notFound(ctx: Koa.Context) {
  ctx.status = 404;
}

declare module '@cardstack/di' {
  interface KnownServices {
    'callbacks-router': CallbacksRouter;
  }
}
