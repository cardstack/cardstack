import Koa from 'koa';
import { inject } from '@cardstack/di';
import { Session } from './session';
import { AuthenticationUtils } from '../utils/authentication';
import Logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';

let log = Logger('middleware:authentication');

export interface SessionContext {
  cardstackSession: Session;
}

export default class AuthenticationMiddleware {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });

  middleware() {
    return async (ctxt: Koa.Context, next: Koa.Next) => {
      if (ctxt.headers['authorization']) {
        let authToken = (ctxt.headers['authorization'] as string).replace('Bearer ', '');
        try {
          let userAddress = this.authenticationUtils.validateAuthToken(authToken);
          ctxt.state.userAddress = userAddress;
          Sentry.configureScope(function (scope) {
            scope.setUser({
              userAddress,
            });
          });
        } catch (e) {
          log.debug('Invalid auth token seen', e);
        }
      }
      ctxt.state.cardstackSession = Session.everyone;
      await next();
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'authentication-middleware': AuthenticationMiddleware;
  }
}
