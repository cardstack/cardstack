import Koa from 'koa';
import Logger from '@cardstack/logger';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
let log = Logger('route:merchant-ids');

export default class MerchantIdsRoute {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let db = await this.databaseManager.getClient();
    try {
      let result = await db.query('SELECT slug FROM merchant_infos');
      let data = result.rows.map((row) => {
        return {
          id: row.id,
          attributes: {
            slug: row.slug,
          },
        };
      });
      ctx.status = 200;
      ctx.body = {
        data,
      };
      ctx.type = 'application/vnd.api+json';
    } catch (e) {
      log.error('Failed to retrieve merchant_infos', e);
    }
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-ids-route': MerchantIdsRoute;
  }
}
