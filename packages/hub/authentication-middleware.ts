import Koa from 'koa';
import { Session } from './session';

export interface SessionContext {
  cardstackSession: Session;
}

export default class AuthenticationMiddleware {
  middleware() {
    return async (ctxt: Koa.Context, next: Koa.Next) => {
      ctxt.state.cardstackSession = Session.EVERYONE;
      await next();
    };
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'authentication-middleware': AuthenticationMiddleware;
  }
}
