import Koa from 'koa';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import DatabaseManager from '../services/database-manager';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '../di/dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';

let log = Logger('route:reservations');

export default class ReservationsRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  relay = inject('relay');

  constructor() {
    autoBind(this);
  }
  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let userAddress = ctx.state.userAddress;
  }
  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let userAddress = ctx.state.userAddress;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'reservations-route': ReservationsRoute;
  }
}
