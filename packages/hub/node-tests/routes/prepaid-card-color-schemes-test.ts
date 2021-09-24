import supertest, { Test } from 'supertest';
import { HubServer } from '../../main';
import { Client } from 'pg';

describe('GET /api/prepaid-card-color-schemes', function () {
  let server: HubServer;
  let db: Client;
  let request: supertest.SuperTest<Test>;
  this.beforeEach(async function () {
    server = await HubServer.create();
    let dbManager = await server.container.lookup('database-manager');
    db = await dbManager.getClient();

    let rows = [
      ['C169F7FE-D83C-426C-805E-DF1D695C30F1', '#efefef', 'black', 'black', 'Solid Gray'],
      [
        '5058B874-CE21-4FC4-958C-B6641E1DC175',
        'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
        'white',
        'white',
        'Awesome Gradient',
      ],
    ];
    for (const row of rows) {
      try {
        await db.query(
          'INSERT INTO prepaid_card_color_schemes(id, background, pattern_color, text_color, description) VALUES($1, $2, $3, $4, $5)',
          row
        );
      } catch (e) {
        console.error(e);
      }
    }
    request = supertest(server.app.callback());
  });

  this.afterEach(async function () {
    server.teardown();
  });

  it('responds with 200 and available color schemes', async function () {
    await request
      .get('/api/prepaid-card-color-schemes')
      .set('Accept', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'prepaid-card-color-schemes',
            id: 'c169f7fe-d83c-426c-805e-df1d695c30f1',
            attributes: {
              background: '#efefef',
              'pattern-color': 'black',
              'text-color': 'black',
              description: 'Solid Gray',
            },
          },
          {
            type: 'prepaid-card-color-schemes',
            id: '5058b874-ce21-4fc4-958c-b6641e1dc175',
            attributes: {
              background: 'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
              'pattern-color': 'white',
              'text-color': 'white',
              description: 'Awesome Gradient',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
