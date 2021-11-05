import { Client as DBClient } from 'pg';
import { setupServer } from '../helpers/server';

describe('/api/wyre-prices', function () {
  let db: DBClient;

  let { getServer, request } = setupServer(this);
  this.beforeEach(async function () {
    let dbManager = await getServer().container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM wyre_prices`);
  });

  describe('GET /api/wyre-prices', function () {
    it(`gets the wyre prices`, async function () {
      await db.query(
        `INSERT INTO wyre_prices (sku, source_currency, dest_currency, source_currency_price ) VALUES ($1, $2, $3, $4)`,
        ['sku1', 'USD', 'DAI', 50.5]
      );
      await db.query(
        `INSERT INTO wyre_prices (sku, source_currency, dest_currency, source_currency_price ) VALUES ($1, $2, $3, $4)`,
        ['sku2', 'USD', 'DAI', 100]
      );

      await request()
        .get(`/api/wyre-prices`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          data: [
            {
              id: 'sku1',
              type: 'wyre-prices',
              attributes: {
                'source-currency': 'USD',
                'dest-currency': 'DAI',
                'source-currency-price': 50.5,
                'includes-fee': false,
              },
            },
            {
              id: 'sku2',
              type: 'wyre-prices',
              attributes: {
                'source-currency': 'USD',
                'dest-currency': 'DAI',
                'source-currency-price': 100,
                'includes-fee': false,
              },
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it(`does not include disabled SKUs`, async function () {
      await db.query(
        `INSERT INTO wyre_prices (sku, source_currency, dest_currency, source_currency_price ) VALUES ($1, $2, $3, $4)`,
        ['sku1', 'USD', 'DAI', 50.5]
      );
      await db.query(
        `INSERT INTO wyre_prices (sku, source_currency, dest_currency, source_currency_price, disabled ) VALUES ($1, $2, $3, $4, $5)`,
        ['sku2', 'USD', 'DAI', 100, true]
      );

      await request()
        .get(`/api/wyre-prices`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          data: [
            {
              id: 'sku1',
              type: 'wyre-prices',
              attributes: {
                'source-currency': 'USD',
                'dest-currency': 'DAI',
                'source-currency-price': 50.5,
                'includes-fee': false,
              },
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });
});
