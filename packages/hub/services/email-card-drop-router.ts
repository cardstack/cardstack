import Router from '@koa/router';
import Koa from 'koa';
import { route } from '@cardstack/hub/routes';

export default class EmailCardDropRouter {
  emailCardDropVerify = route('email-card-drop-verify', { as: 'emailCardDropVerify' });

  routes() {
    let emailCardDropSubrouter = new Router();
    emailCardDropSubrouter.get('/verify', this.emailCardDropVerify.get);
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
