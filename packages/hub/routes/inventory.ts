import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import qs from 'qs';

export default class InventoryRoute {
  authenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  inventory = inject('inventory');

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

    let data = await this.inventory.getSKUSummaries(issuer);

    ctx.status = 200;
    ctx.body = {
      data,
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'route:inventory': InventoryRoute;
  }
}
