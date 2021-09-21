import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '../di/dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';
import { getSKUSummaries } from './utils/inventory';

export default class InventoryRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  subgraph = inject('subgraph');
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let data = await getSKUSummaries(await this.databaseManager.getClient(), this.subgraph);

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
