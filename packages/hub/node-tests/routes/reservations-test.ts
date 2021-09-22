import { Client as DBClient } from 'pg';
import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { bootServerForTesting } from '../../main';
import { Container } from '../../di/dependency-injection';
import { Registry } from '../../di/dependency-injection';
import { InventorySubgraph } from '../../services/subgraph';
import { makeInventoryData } from '../helpers';
import Web3 from 'web3';
import { v4 as uuidv4 } from 'uuid';

const { toWei } = Web3.utils;

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();
let stubInventorySubgraph: () => InventorySubgraph;

class StubAuthenticationUtils {
  generateNonce() {
    return stubNonce;
  }
  buildAuthToken() {
    return stubAuthToken;
  }
  extractVerifiedTimestamp(_nonce: string) {
    return stubTimestamp;
  }

  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

class StubSubgraph {
  async getInventory(reservedPrepaidCards: string[]): Promise<InventorySubgraph> {
    let result = stubInventorySubgraph();
    // this replicates the subgraph's where clause for reserved cards
    for (let inventory of result.data.skuinventories) {
      inventory.prepaidCards = inventory.prepaidCards.filter((p) => !reservedPrepaidCards.includes(p.prepaidCardId));
    }
    return Promise.resolve(result);
  }
}

let stubUserAddress1 = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
let stubUserAddress2 = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';

function handleValidateAuthToken(encryptedString: string) {
  switch (encryptedString) {
    case 'abc123--def456--ghi789':
      return stubUserAddress1;
    case 'mno123--pqr456--stu789':
      return stubUserAddress2;
  }
  return;
}

describe('/api/reservations', function () {
  let server: Server;
  let db: DBClient;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    let container!: Container;

    server = await bootServerForTesting({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
        registry.register('subgraph', StubSubgraph);
      },
      containerCallback(serverContainer: Container) {
        container = serverContainer;
      },
    });
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [],
      },
    });

    let dbManager = await container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM reservations`);
    await db.query(`DELETE FROM wallet_orders`);

    request = supertest(server);
  });

  this.afterEach(async function () {
    server.close();
  });

  describe('POST /api/reservations', function () {
    it(`creates a new reservation for an authenticated client when inventory exists`, async function () {
      stubInventorySubgraph = () => ({
        data: {
          skuinventories: [
            makeInventoryData('sku1', '100', toWei('1'), [
              '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC',
              '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad',
            ]),
          ],
        },
      });

      const payload = {
        data: {
          type: 'reservations',
          attributes: {
            sku: 'sku1',
          },
        },
      };

      let reservationId;

      await request
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(function (res) {
          reservationId = res.body.data.id;
          res.body.data.id = 'stubId';
        })
        .expect({
          data: {
            id: 'stubId',
            type: 'reservations',
            attributes: {
              'user-address': stubUserAddress1.toLowerCase(),
              sku: 'sku1',
              'transaction-hash': null,
              'prepaid-card-address': null,
            },
          },
        })
        .expect('Content-Type', 'application/vnd.api+json');

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM reservations where id = $1`, [reservationId]);
      expect(row.user_address).to.equal(stubUserAddress1.toLowerCase());
      expect(row.sku).to.equal('sku1');
      expect(row.prepaid_card_address).to.equal(null);
      expect(row.transaction_hash).to.equal(null);
    });

    it('returns 422 when payload is missing sku', async function () {
      stubInventorySubgraph = () => ({
        data: {
          skuinventories: [
            makeInventoryData('sku1', '100', toWei('1'), [
              '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC',
              '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad',
            ]),
          ],
        },
      });

      const payload = {
        data: {
          type: 'reservations',
          attributes: {},
        },
      };

      await request
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Missing required attribute: sku',
              detail: 'Required field sku was not provided',
            },
          ],
        });

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(0);
    });

    it(`returns 401 when client is not authenticated`, async function () {
      stubInventorySubgraph = () => ({
        data: {
          skuinventories: [
            makeInventoryData('sku1', '100', toWei('1'), [
              '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC',
              '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad',
            ]),
          ],
        },
      });

      const payload = {
        data: {
          type: 'reservations',
          attributes: {
            sku: 'sku1',
          },
        },
      };

      await request
        .post(`/api/reservations`)
        .send(payload)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(401)
        .expect({
          errors: [
            {
              status: '401',
              title: 'No valid auth token',
            },
          ],
        });

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(0);
    });

    it(`returns 400 when there is no inventory to reserve`, async function () {
      stubInventorySubgraph = () => ({
        data: {
          skuinventories: [makeInventoryData('sku1', '100', toWei('1'), [])],
        },
      });
      const payload = {
        data: {
          type: 'reservations',
          attributes: {
            sku: 'sku1',
          },
        },
      };

      await request
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(400)
        .expect({
          errors: [
            {
              status: '400',
              title: 'No inventory available',
              detail: 'There are no more prepaid cards available for the SKU sku1',
            },
          ],
        });

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(0);
    });

    it(`returns 400 for non-existent sku`, async function () {
      const payload = {
        data: {
          type: 'reservations',
          attributes: {
            sku: 'sku1',
          },
        },
      };

      await request
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(400)
        .expect({
          errors: [
            {
              status: '400',
              title: 'SKU does not exist',
              detail: 'The SKU sku1 does not exist',
            },
          ],
        });

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(0);
    });
  });

  describe('GET /api/reservations/:reservation_id', function () {
    let reservationId: string;
    this.beforeEach(async function () {
      let {
        rows: [{ id }],
      } = await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2) RETURNING id`, [
        stubUserAddress1.toLowerCase(),
        'sku1',
      ]);
      reservationId = id;
    });

    it(`returns an authenticated client's reservation`, async function () {
      await request
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          data: {
            id: reservationId,
            type: 'reservations',
            attributes: {
              'user-address': stubUserAddress1.toLowerCase(),
              sku: 'sku1',
              'transaction-hash': null,
              'prepaid-card-address': null,
            },
          },
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it(`returns 401 when client is not authenticated`, async function () {
      await request
        .get(`/api/reservations/${reservationId}`)
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(401)
        .expect({
          errors: [
            {
              status: '401',
              title: 'No valid auth token',
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    // we return 404 so we don't leak the existence of reservations that aren't yours
    it(`returns 404 when authenticated client gets a different user's record`, async function () {
      await request
        .get(`/api/reservations/${reservationId}`)
        .set('Authorization', 'Bearer: mno123--pqr456--stu789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404)
        .expect({
          errors: [
            {
              status: '404',
              title: 'Reservation not found',
              detail: `Could not find the reservation ${reservationId}`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it(`returns 404 when authenticated client gets a non-uuid reservation ID`, async function () {
      await request
        .get(`/api/reservations/DOES_NOT_EXIST`)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404)
        .expect({
          errors: [
            {
              status: '404',
              title: 'Reservation not found',
              detail: `Could not find the reservation DOES_NOT_EXIST`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it(`returns 404 when authenticated client gets a reservation ID that does not exist`, async function () {
      let doesNotExist = uuidv4();
      await request
        .get(`/api/reservations/${doesNotExist}`)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404)
        .expect({
          errors: [
            {
              status: '404',
              title: 'Reservation not found',
              detail: `Could not find the reservation ${doesNotExist}`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });
});
