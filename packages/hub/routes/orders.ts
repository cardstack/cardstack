import Koa from 'koa';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import DatabaseManager from '../services/database-manager';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '../di/dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';
import Web3 from 'web3';

let log = Logger('route:orders');

export default class OrdersRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });

  constructor() {
    autoBind(this);
  }
  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let userAddress = ctx.state.userAddress;
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let userAddress = ctx.state.userAddress;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'orders-route': OrdersRoute;
  }
}
