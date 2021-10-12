import { Client } from 'pg';
import { setupServer } from '../helpers/server';

describe('GET /api/prepaid-card-patterns', function () {
  let db: Client;
  let { getServer, request } = setupServer(this);

  this.beforeEach(async function () {
    let dbManager = await getServer().container.lookup('database-manager');
    db = await dbManager.getClient();

    let rows = [
      ['543423cb-de7e-44c2-a9e1-902b4648b8fb', 'https://example.com/a.svg', 'Pattern A'],
      ['72b654e4-dd4a-4a89-a78c-43a9baa7f354', 'https://example.com/b.svg', 'Pattern B'],
    ];
    for (const row of rows) {
      try {
        await db.query('INSERT INTO prepaid_card_patterns(id, pattern_url, description) VALUES($1, $2, $3)', row);
      } catch (e) {
        console.error(e);
      }
    }
  });

  it('responds with 200 and available header patterns', async function () {
    await request()
      .get('/api/prepaid-card-patterns')
      .set('Accept', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'prepaid-card-patterns',
            id: '543423cb-de7e-44c2-a9e1-902b4648b8fb',
            attributes: {
              'pattern-url': 'https://example.com/a.svg',
              description: 'Pattern A',
            },
          },
          {
            type: 'prepaid-card-patterns',
            id: '72b654e4-dd4a-4a89-a78c-43a9baa7f354',
            attributes: {
              'pattern-url': 'https://example.com/b.svg',
              description: 'Pattern B',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
