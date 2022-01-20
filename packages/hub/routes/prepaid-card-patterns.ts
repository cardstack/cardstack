import Koa from 'koa';
import Logger from '@cardstack/logger';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
let log = Logger('route:prepaid-card-patterns');

export default class PrepaidCardPatternsRoute {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let db = await this.databaseManager.getClient();
    try {
      let result = await db.query('SELECT id, pattern_url, description FROM prepaid_card_patterns');
      let data = result.rows.map((row) => {
        return {
          id: row.id,
          type: 'prepaid-card-patterns',
          attributes: {
            'pattern-url': row.pattern_url,
            description: row.description,
          },
        };
      });
      ctx.status = 200;
      ctx.body = {
        data,
      };
      ctx.type = 'application/vnd.api+json';
    } catch (e) {
      log.error('Failed to retrieve prepaid_card_patterns', e);
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'route:prepaid-card-patterns': PrepaidCardPatternsRoute;
  }
}
