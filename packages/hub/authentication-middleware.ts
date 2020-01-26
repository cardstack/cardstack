import Koa from 'koa';
import { Session } from '@cardstack/core/session';

export interface SessionContext {
  cardstackSession: Session;
}

export default class AuthenticationMiddleware {
  middleware() {
    return (ctxt: Koa.Context, next: Koa.Next) => {
      ctxt.state.cardstackSession = Session.EVERYONE;
      next();
    };
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'authentication-middleware': AuthenticationMiddleware;
  }
}
