import { Client as DBClient } from 'pg';
import { Registry } from '../../di/dependency-injection';
import { InventorySubgraph } from '../../services/subgraph';
import { makeInventoryData } from '../helpers';
import Web3 from 'web3';
import { v4 as uuidv4 } from 'uuid';
import { setupServer } from '../helpers/server';

const { toWei } = Web3.utils;

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();
let stubWeb3Available = true;
let stubRelayAvailable = true;
let stubInventorySubgraph: () => InventorySubgraph;
let defaultContractMethods = {
  cardpayVersion() {
    return {
      async call() {
        return Promise.resolve('any');
      },
    };
  },
};
let contractPauseMethod = (isPaused: boolean) => ({
  paused() {
    return {
      async call() {
        return Promise.resolve(isPaused);
      },
    };
  },
});
let stubMarketContract: () => any;

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

class StubWeb3 {
  isAvailable() {
    return Promise.resolve(stubWeb3Available);
  }
  getInstance() {
    return {
      eth: {
        net: {
          getId() {
            return 77; // sokol network id
          },
        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        Contract: class {
          get methods() {
            return stubMarketContract();
          }
        },
      },
    };
  }
}
class StubRelay {
  isAvailable() {
    return Promise.resolve(stubRelayAvailable);
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
  let db: DBClient;

  let { getServer, request } = setupServer(this, {
    registryCallback(registry: Registry) {
      registry.register('authentication-utils', StubAuthenticationUtils);
      registry.register('subgraph', StubSubgraph);
      registry.register('web3', StubWeb3);
      registry.register('relay', StubRelay);
    },
  });

  this.beforeEach(async function () {
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [],
      },
    });

    let dbManager = await getServer().container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM reservations`);
    await db.query(`DELETE FROM wallet_orders`);

    stubMarketContract = () => ({
      ...defaultContractMethods,
      ...contractPauseMethod(false),
    });
    stubRelayAvailable = true;
    stubWeb3Available = true;
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

      await request()
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

    it('when a new reservation is created, existing reservations without an order relationship are removed for a user', async function () {
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
      let {
        rows: [{ id: abandonedReservationId }],
      } = await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2) RETURNING id`, [
        stubUserAddress1.toLowerCase(),
        'sku1',
      ]);

      const payload = {
        data: {
          type: 'reservations',
          attributes: {
            sku: 'sku1',
          },
        },
      };

      let reservationId;
      await request()
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(function (res) {
          reservationId = res.body.data.id;
        });

      expect(reservationId).does.not.equal(abandonedReservationId);

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(1);
      expect(rows[0].id).to.equal(reservationId);
    });

    it('when a new reservation is created, existing reservations with an order relationship are not removed for a user', async function () {
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
      let {
        rows: [{ id: initialReservationId }],
      } = await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2) RETURNING id`, [
        stubUserAddress1.toLowerCase(),
        'sku1',
      ]);
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, reservation_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          'WO_WALLET_ORDER',
          stubUserAddress1.toLowerCase(),
          'WA_CUSTODIAL_WALLET',
          initialReservationId,
          'waiting-for-order',
        ]
      );

      const payload = {
        data: {
          type: 'reservations',
          attributes: {
            sku: 'sku1',
          },
        },
      };

      let reservationId;
      await request()
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(function (res) {
          reservationId = res.body.data.id;
        });

      expect(reservationId).does.not.equal(initialReservationId);

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(2);
      let ids = rows.map((row) => row.id);
      expect(ids.includes(initialReservationId)).to.equal(true, 'initial reservation ID is in DB');
      expect(ids.includes(reservationId)).to.equal(true, 'new reservation ID is in DB');
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

      await request()
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

      await request()
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

    it(`returns 503 when contract is paused`, async function () {
      stubMarketContract = () => ({
        ...defaultContractMethods,
        ...contractPauseMethod(true),
      });

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
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(503)
        .expect({
          errors: [
            {
              status: '503',
              title: 'Contract paused',
              detail: 'The market contract is paused',
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(0);
    });

    it(`returns 503 when RPC node is unavailable`, async function () {
      stubWeb3Available = false;

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
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(503)
        .expect({
          errors: [
            {
              status: '503',
              title: 'RPC Node Unavailable',
              detail: 'The RPC node is unavailable',
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');

      let { rows } = await db.query(`SELECT * FROM reservations`);
      expect(rows.length).to.equal(0);
    });

    it(`returns 503 when relay server is unavailable`, async function () {
      stubRelayAvailable = false;

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
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(503)
        .expect({
          errors: [
            {
              status: '503',
              title: 'Relay Server Unavailable',
              detail: 'The relay server is unavailable',
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');

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

      await request()
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

      await request()
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
      await request()
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
      await request()
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
      await request()
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
      await request()
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
      await request()
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
