import { Client as DBClient } from 'pg';
import { InventorySubgraph } from '../../services/subgraph';
import { v4 as uuidv4 } from 'uuid';
import { WyreWallet } from '../../services/wyre';
import * as JSONAPI from 'jsonapi-typescript';
import { registry, setupHub } from '../helpers/server';

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();
let stubInventorySubgraph: () => InventorySubgraph;
let stubProvisionPrepaidCard: (userAddress: string, sku: string) => string;
let stubWaitForPrepaidCardTxn: (txnHash: string) => string;
let stubGetWalletByUserAddress: (userAddress: string) => WyreWallet | undefined;

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
  async waitForProvisionedPrepaidCard(txnHash: string): Promise<string> {
    return Promise.resolve(stubWaitForPrepaidCardTxn(txnHash));
  }
}

class StubRelayService {
  async provisionPrepaidCard(userAddress: string, reservationId: string) {
    return Promise.resolve(stubProvisionPrepaidCard(userAddress, reservationId));
  }
}

class StubWyreService {
  async getWalletByUserAddress(userAddress: string): Promise<WyreWallet | undefined> {
    return Promise.resolve(stubGetWalletByUserAddress(userAddress));
  }
}

const stubUserAddress1 = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
const stubUserAddress2 = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';
const stubCustodialWalletId = 'WA_CUSTODIAL_WALLET';
const stubWalletOrderId = 'WO_WALLET_ORDER';
const stubCustodialTransferId = 'TF_CUSTODIAL_TRANSFER';
const stubSKU = 'sku1';
const stubProvisionTxnHash = '0x1234567890123456789012345678901234567890';
const stubPrepaidCardAddress = '0xe732F27E31e8e0A17c5069Af7cDF277bA7E6Eff5';

function handleValidateAuthToken(encryptedString: string) {
  switch (encryptedString) {
    case 'abc123--def456--ghi789':
      return stubUserAddress1;
    case 'mno123--pqr456--stu789':
      return stubUserAddress2;
  }
  return;
}

describe('/api/orders', function () {
  let db: DBClient;
  let reservationId: string;

  this.beforeEach(function () {
    registry(this).register('relay', StubRelayService, { type: 'service' });
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('subgraph', StubSubgraph);
    registry(this).register('wyre', StubWyreService);
  });

  let { getContainer, request } = setupHub(this);

  this.beforeEach(async function () {
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [],
      },
    });

    stubGetWalletByUserAddress = (userAddress) => {
      // the wyre service impl also uses a case insensitive address
      if (userAddress.toLowerCase() === stubUserAddress1.toLowerCase()) {
        return {
          id: stubCustodialWalletId,
          name: stubUserAddress1.toLowerCase(),
          callbackUrl: null,
          depositAddresses: {},
        };
      }
      return {
        id: 'WA_RANDOM_WALLET',
        name: 'random',
        callbackUrl: null,
        depositAddresses: {},
      };
    };

    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM reservations`);
    await db.query(`DELETE FROM wallet_orders`);

    let {
      rows: [{ id }],
    } = await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2) RETURNING id`, [
      stubUserAddress1.toLowerCase(),
      stubSKU,
    ]);
    reservationId = id;
  });

  describe('POST /api/orders', function () {
    it('creates an order/reservation correlation for an authenticated client that has not yet received wyre callback', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };

      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(
          orderDocument(
            stubWalletOrderId,
            stubUserAddress1.toLowerCase(),
            stubCustodialWalletId,
            'waiting-for-order',
            reservationId
          )
        )
        .expect('Content-Type', 'application/vnd.api+json');

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(1);

      let [row] = rows;
      expect(row.user_address).to.equal(stubUserAddress1.toLowerCase());
      expect(row.wallet_id).to.equal(stubCustodialWalletId);
      expect(row.custodial_transfer_id).to.equal(null);
      expect(row.reservation_id).to.equal(reservationId);
      expect(row.status).to.equal('waiting-for-order');
    });

    it('creates an order/reservation correlation for an authenticated client that has received a receive-funds wyre callback', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          stubWalletOrderId,
          stubUserAddress1.toLowerCase(),
          stubCustodialWalletId,
          stubCustodialTransferId,
          'received-order',
        ]
      );

      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(
          orderDocument(
            stubWalletOrderId,
            stubUserAddress1.toLowerCase(),
            stubCustodialWalletId,
            'received-order',
            reservationId
          )
        )
        .expect('Content-Type', 'application/vnd.api+json');

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(1);

      let [row] = rows;
      expect(row.user_address).to.equal(stubUserAddress1.toLowerCase());
      expect(row.wallet_id).to.equal(stubCustodialWalletId);
      expect(row.custodial_transfer_id).to.equal(stubCustodialTransferId);
      expect(row.reservation_id).to.equal(reservationId);
      expect(row.status).to.equal('received-order');
    });

    it('creates an order/reservation correlation for an authenticated client that has received a send-funds wyre callback', async function () {
      let invokeProvisionCount = 0;
      let invokeWaitForPrepaidCardTxnCount = 0;
      stubProvisionPrepaidCard = (userAddress, sku) => {
        invokeProvisionCount++;
        expect(userAddress).to.equal(stubUserAddress1);
        expect(sku).to.equal(stubSKU);
        return stubProvisionTxnHash;
      };
      stubWaitForPrepaidCardTxn = (txnHash) => {
        invokeWaitForPrepaidCardTxnCount++;
        expect(txnHash).to.equal(stubProvisionTxnHash);
        return stubPrepaidCardAddress;
      };

      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          stubWalletOrderId,
          stubUserAddress1.toLowerCase(),
          stubCustodialWalletId,
          stubCustodialTransferId,
          'waiting-for-reservation',
        ]
      );

      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(
          orderDocument(
            stubWalletOrderId,
            stubUserAddress1.toLowerCase(),
            stubCustodialWalletId,
            'complete',
            reservationId,
            stubProvisionTxnHash,
            stubPrepaidCardAddress
          )
        )
        .expect('Content-Type', 'application/vnd.api+json');

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(1);

      let [row] = rows;
      expect(row.user_address).to.equal(stubUserAddress1.toLowerCase());
      expect(row.wallet_id).to.equal(stubCustodialWalletId);
      expect(row.custodial_transfer_id).to.equal(stubCustodialTransferId);
      expect(row.reservation_id).to.equal(reservationId);
      expect(row.status).to.equal('complete');

      expect(invokeProvisionCount).to.equal(1);
      expect(invokeWaitForPrepaidCardTxnCount).to.equal(1);

      let {
        rows: [{ transaction_hash: txnHash, prepaid_card_address: prepaidCardAddress }],
      } = await db.query(`SELECT * FROM reservations where id = $1`, [reservationId]);
      expect(txnHash).to.equal(stubProvisionTxnHash);
      expect(prepaidCardAddress).to.equal(stubPrepaidCardAddress);
    });

    it('returns 401 when client is not authenticated', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };

      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId))
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

    it('returns 422 when client creates an order for a reservation that does not correlate to the address of their auth token', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId))
        .set('Authorization', 'Bearer mno123--pqr456--stu789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Cannot create order',
              detail: `Could not locate reservation ${reservationId}`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when reservation field refers to non-existent reservation UUID', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      let doesNotExist = uuidv4();
      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, doesNotExist))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Cannot create order',
              detail: `Could not locate reservation ${doesNotExist}`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when reservation field refers a non-UUID', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, 'DOES_NOT_EXIST'))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Cannot create order',
              detail: `Could not locate reservation DOES_NOT_EXIST`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when client creates an order with a wallet id that does not correlate to the address of their auth token', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(stubWalletOrderId, 'WA_SOME_OTHER_WALLET', reservationId))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Cannot create order',
              detail: `Could not locate wallet WA_SOME_OTHER_WALLET`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when client creates an order with an order id that does not correlate to the address of their auth token', async function () {
      let badOrderId = 'WO_BAD_ORDER';
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          badOrderId,
          stubUserAddress2.toLowerCase(),
          stubCustodialWalletId,
          stubCustodialTransferId,
          'waiting-for-reservation',
        ]
      );

      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(badOrderId, stubCustodialWalletId, reservationId))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Cannot create order',
              detail: `Could not locate order ${badOrderId}`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when client creates an order with an order id for an order that does not correlate to the wallet id', async function () {
      let badOrderId = 'WO_BAD_ORDER';
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          badOrderId,
          stubUserAddress1.toLowerCase(),
          'WA_SOME_OTHER_WALLET',
          stubCustodialTransferId,
          'waiting-for-reservation',
        ]
      );
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      await request()
        .post(`/api/orders`)
        .send(makeOrderPayload(badOrderId, stubCustodialWalletId, reservationId))
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Cannot create order',
              detail: `Could not locate order ${badOrderId}`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when order-id field is missing', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      let payload: any = makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId);
      delete payload.data.attributes['order-id'];
      await request()
        .post(`/api/orders`)
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Missing required attribute: order-id',
              detail: `Required field order-id was not provided`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when wallet-id field is missing', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      let payload: any = makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId);
      delete payload.data.attributes['wallet-id'];
      await request()
        .post(`/api/orders`)
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Missing required attribute: wallet-id',
              detail: `Required field wallet-id was not provided`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 422 when reservation field is missing', async function () {
      stubProvisionPrepaidCard = (_userAddress, _sku) => {
        throw new Error('should not provision a prepaid card');
      };
      stubWaitForPrepaidCardTxn = (_txnHash) => {
        throw new Error('should not wait for prepaid card txn');
      };
      let payload: any = makeOrderPayload(stubWalletOrderId, stubCustodialWalletId, reservationId);
      delete payload.data.relationships.reservation;
      await request()
        .post(`/api/orders`)
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          errors: [
            {
              status: '422',
              title: 'Missing required relationship: reservation',
              detail: `Required relationship reservation was not provided`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });

  describe('GET /api/orders', function () {
    this.beforeEach(async function () {
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          stubWalletOrderId,
          stubUserAddress1.toLowerCase(),
          stubCustodialWalletId,
          stubCustodialTransferId,
          'received-order',
        ]
      );
    });

    it('can get an order', async function () {
      await request()
        .get(`/api/orders/${stubWalletOrderId}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect(
          orderDocument(stubWalletOrderId, stubUserAddress1.toLowerCase(), stubCustodialWalletId, 'received-order')
        )
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('can get an order with an included reservation that has a provisioned prepaid card', async function () {
      await db.query(`UPDATE reservations SET transaction_hash = $1, prepaid_card_address = $2 WHERE id = $3`, [
        stubProvisionTxnHash,
        stubPrepaidCardAddress,
        reservationId,
      ]);
      await db.query(`UPDATE wallet_orders SET reservation_id = $1, status = $2 WHERE order_id = $3`, [
        reservationId,
        'complete',
        stubWalletOrderId,
      ]);
      await request()
        .get(`/api/orders/${stubWalletOrderId}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect(
          orderDocument(
            stubWalletOrderId,
            stubUserAddress1.toLowerCase(),
            stubCustodialWalletId,
            'complete',
            reservationId,
            stubProvisionTxnHash,
            stubPrepaidCardAddress
          )
        )
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns 401 when client is not authenticated', async function () {
      await request()
        .get(`/api/orders/${stubWalletOrderId}`)
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

    // we return a 404 so we don't leak the existence of orders
    it('returns a 404 when client asks for an order that is not their own', async function () {
      await request()
        .get(`/api/orders/${stubWalletOrderId}`)
        .set('Authorization', 'Bearer mno123--pqr456--stu789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404)
        .expect({
          errors: [
            {
              status: '404',
              title: 'Order not found',
              detail: `Order ${stubWalletOrderId} not found`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns a 404 when client asks for a non existent order', async function () {
      await request()
        .get(`/api/orders/DOES_NOT_EXIST`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404)
        .expect({
          errors: [
            {
              status: '404',
              title: 'Order not found',
              detail: `Order DOES_NOT_EXIST not found`,
            },
          ],
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });
});

function makeOrderPayload(orderId: string, walletId: string, reservationId: string) {
  return {
    data: {
      type: 'orders',
      relationships: {
        reservation: {
          data: {
            type: 'reservations',
            id: reservationId,
          },
        },
      },
      attributes: {
        'order-id': orderId,
        'wallet-id': walletId,
      },
    },
  };
}

function orderDocument(
  orderId: string,
  userAddress: string,
  walletId: string,
  status: string,
  reservationId: string | null = null,
  txnHash: string | null = null,
  prepaidCardAddress: string | null = null
): JSONAPI.Document {
  let order: JSONAPI.ResourceObject = {
    id: orderId,
    type: 'orders',
    attributes: {
      'order-id': orderId,
      'user-address': userAddress,
      'wallet-id': walletId,
      status,
    },
    relationships: {
      reservation: { data: null },
    },
  };

  if (reservationId == null) {
    return { data: order };
  }
  order.relationships = {
    reservation: { data: { id: reservationId, type: 'reservations' } },
  };

  return {
    data: order,
    included: [
      {
        id: reservationId,
        type: 'reservations',
        attributes: {
          'user-address': userAddress,
          sku: stubSKU,
          'transaction-hash': txnHash,
          'prepaid-card-address': prepaidCardAddress,
        },
      },
    ],
  };
}
