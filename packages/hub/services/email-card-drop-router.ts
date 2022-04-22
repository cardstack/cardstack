import Router from '@koa/router';
import Koa from 'koa';
import { route } from '@cardstack/hub/routes';

export default class EmailCardDropRouter {
  // FIXME this filename is too brief… had trouble with DI though
  verify = route('verify');

  routes() {
    let emailCardDropSubrouter = new Router();
    emailCardDropSubrouter.get('/verify', this.verify.get);
    emailCardDropSubrouter.all('/(.*)', notFound);

    let emailCardDropRouter = new Router();
    emailCardDropRouter.use(
      '/email-card-drop',
      emailCardDropSubrouter.routes(),
      emailCardDropSubrouter.allowedMethods()
    );
    return emailCardDropRouter.routes();
  }
}

function notFound(ctx: Koa.Context) {
  ctx.status = 404;
}

declare module '@cardstack/di' {
  interface KnownServices {
    'email-card-drop-router': EmailCardDropRouter;
  }
}
