import Koa from 'koa';
import Logger from '@cardstack/logger';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
let log = Logger('route:prepaid-card-color-schemes');

export default class PrepaidCardColorSchemesRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    try {
      let result = await prisma.prepaid_card_color_schemes.findMany();
      let data = result.map((row) => {
        return {
          id: row.id,
          type: 'prepaid-card-color-schemes',
          attributes: {
            background: row.background,
            'pattern-color': row.pattern_color,
            'text-color': row.text_color,
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
      log.error('Failed to retrieve prepaid_card_color_schemes', e);
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prepaid-card-color-schemes-route': PrepaidCardColorSchemesRoute;
  }
}
