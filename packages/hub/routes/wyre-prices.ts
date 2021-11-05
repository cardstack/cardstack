import { inject } from '@cardstack/di';
import autoBind from 'auto-bind';
import Koa from 'koa';

export default class WyrePricesRoute {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let db = await this.databaseManager.getClient();
    let { rows } = await db.query(`SELECT * FROM wyre_prices WHERE disabled = false ORDER BY sku`);
    let data = rows.map(
      ({
        sku,
        source_currency: sourceCurrency,
        dest_currency: destCurrency,
        source_currency_price: sourceCurrencyPrice,
        includes_fee: includesFee,
      }) => {
        return {
          id: sku,
          type: 'wyre-prices',
          attributes: {
            'source-currency': sourceCurrency,
            'dest-currency': destCurrency,
            'source-currency-price': Number(sourceCurrencyPrice),
            'includes-fee': includesFee,
          },
        };
      }
    );

    ctx.status = 200;
    ctx.body = {
      data,
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'wyre-prices-route': WyrePricesRoute;
  }
}
