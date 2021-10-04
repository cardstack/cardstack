import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '../di/dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';
import { getSKUSummaries } from './utils/inventory';
import qs from 'qs';

export default class InventoryRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  subgraph = inject('subgraph');
  web3 = inject('web3');
  relay = inject('relay');
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let query = qs.parse(ctx.querystring);
    let filter = query?.filter;
    let issuer: string | undefined;
    if (typeof filter === 'object' && 'issuer' in filter && typeof filter.issuer === 'string') {
      issuer = filter.issuer;
    }

    let data = await getSKUSummaries(
      await this.databaseManager.getClient(),
      this.subgraph,
      this.web3,
      this.relay,
      issuer
    );

    ctx.status = 200;
    ctx.body = {
      data,
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'inventory-route': InventoryRoute;
  }
}
