import { Client as DBClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { registry, setupHub } from '../helpers/server';
import {
  StubWyreService,
  stubCustodialTransferId,
  stubCustodialWalletId,
  stubUserAddress,
  stubWalletOrderId,
  stubWalletOrderTransferId,
  adminWalletId,
} from '../helpers/wyre';

class StubRelayService {
  async provisionPrepaidCard(userAddress: string, reservationId: string): Promise<string> {
    return Promise.resolve(handleProvisionPrepaidCard(userAddress, reservationId));
  }
}

class StubSubgraphService {
  async waitForProvisionedPrepaidCard(txnHash: string): Promise<string> {
    return Promise.resolve(handleWaitForPrepaidCardTxn(txnHash));
  }
}

class StubWorkerClient {
  addJob(jobName: string, payload: any) {
    handleAddJob(jobName, payload);
  }
}

const stubUserAddress2 = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';
const stubSKU = 'sku1';
const stubProvisionTxnHash = '0x1234567890123456789012345678901234567890';
const stubPrepaidCardAddress = '0xe732F27E31e8e0A17c5069Af7cDF277bA7E6Eff5';
const stubReservationId = uuidv4();

let provisionPrepaidCardCallCount = 0;
let waitForPrepaidCardTxnCallCount = 0;
let addJobCallCount = 0;

function handleWaitForPrepaidCardTxn(txnHash: string) {
  waitForPrepaidCardTxnCallCount++;
  expect(txnHash).to.equal(stubProvisionTxnHash);
  return stubPrepaidCardAddress;
}

function handleProvisionPrepaidCard(userAddress: string, sku: string) {
  provisionPrepaidCardCallCount++;
  if (sku === 'boom') {
    let err = new Error('boom');
    (err as any).intentionalTestError = true;
    throw err;
  }
  expect(userAddress).to.equal(stubUserAddress);
  expect(sku).to.equal(stubSKU);
  return stubProvisionTxnHash;
}

function handleAddJob(jobName: string, payload: any, options?: any) {
  addJobCallCount++;
  expect(jobName).to.equal('wyre-transfer');
  expect(payload.request.transfer.destCurrency).to.equal('DAI', 'destCurrency is correct');
  expect(payload.request.transfer.destAmount).to.equal(100, 'destAmount is correct');
  expect(payload.request.order.id).to.equal(stubWalletOrderId, 'request order id is correct');
  expect(payload.request.wallet.name).to.equal(stubUserAddress.toLowerCase(), 'request wallet name is correct');
  expect(payload.request.wallet.id).to.equal(stubCustodialWalletId, 'request wallet id is correct');
  expect(payload.dest).to.equal(adminWalletId, 'destination wallet id is correct');
  expect(options.jobKey).to.equal(stubWalletOrderId, 'jobKey is correct');
}

describe('POST /api/wyre-callback', function () {
  let db: DBClient;
  let wyreService: StubWyreService;

  function post(url: string) {
    return request().post(url);
  }

  this.beforeEach(function () {
    registry(this).register('wyre', StubWyreService);
    registry(this).register('relay', StubRelayService, { type: 'service' });
    registry(this).register('subgraph', StubSubgraphService);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { getContainer, request } = setupHub(this);

  this.beforeEach(async function () {
    waitForPrepaidCardTxnCallCount = 0;
    provisionPrepaidCardCallCount = 0;
    addJobCallCount = 0;
    wyreService = (await getContainer().lookup('wyre')) as unknown as StubWyreService;
    wyreService.wyreTransferCallCount = 0;

    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM wallet_orders`);
    await db.query(`DELETE FROM reservations`);
  });

  it(`returns 400 when the shape of the request does not match the expected format`, async function () {
    await post(`/callbacks/wyre`)
      .set('Content-Type', 'application/json')
      .set('Content-Type', 'application/json')
      .send({
        not: 'a valid callback request',
      })
      .expect(400);
  });

  describe('wallet order callbacks', function () {
    it(`can process callback for wallet order`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:${stubWalletOrderTransferId}`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(addJobCallCount).to.equal(1, 'addJob called once');
    });

    it(`ignores callback for pending wallet order we already received reservation for where the user address in the callback does not match the user address in the DB`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress2.toLowerCase(),
        stubSKU,
      ]);
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, reservation_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          stubWalletOrderId,
          stubUserAddress2.toLowerCase(),
          stubCustodialWalletId,
          stubReservationId,
          'waiting-for-order',
        ]
      );

      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:${stubWalletOrderTransferId}`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(1);

      let [row] = rows;
      expect(row.user_address).to.equal(stubUserAddress2.toLowerCase());
      expect(row.wallet_id).to.equal(stubCustodialWalletId);
      expect(row.custodial_transfer_id).to.equal(null);
      expect(row.status).to.equal('waiting-for-order');
    });

    it(`ignores callback with an order ID that already exists and is not in a "waiting-for-order" state`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        stubSKU,
      ]);
      for (let status of ['received-order', 'waiting-for-reservation', 'provisioning', 'complete']) {
        await db.query(`DELETE FROM wallet_orders`);
        await db.query(
          `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, reservation_id, status) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            stubWalletOrderId,
            stubUserAddress.toLowerCase(),
            stubCustodialWalletId,
            stubCustodialTransferId,
            stubReservationId,
            status,
          ]
        );

        await post(`/callbacks/wyre`)
          .set('Content-Type', 'application/json')
          .set('Content-Type', 'application/json')
          .send({
            source: `transfer:${stubWalletOrderTransferId}`,
            dest: `wallet:${stubCustodialWalletId}`,
            currency: 'DAI',
            amount: 100,
            status: 'CONFIRMED',
          })
          .expect(204);

        expect(wyreService.wyreTransferCallCount).to.equal(0);
        expect(provisionPrepaidCardCallCount).to.equal(0);
        expect(waitForPrepaidCardTxnCallCount).to.equal(0);

        let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
        expect(rows.length).to.equal(1);
      }
    });

    it(`ignores callback with non-existent wyre wallet ID`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:${stubWalletOrderTransferId}`,
          dest: `wallet:WA_DOES_NOT_EXIST`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with non-existent transfer ID`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:TF_DOES_NOT_EXIST`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with non-completed transfer status`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:TF_PENDING`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with transfer source that does not derive from a wallet order`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:TF_NON_WALLET_ORDER_SOURCE`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with transfer source that refers to non-existent wallet order`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:TF_NON_EXISTENT_WALLET_ORDER_SOURCE`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with transfer ID that does not match the transfer ID associated with the wallet order`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:TF_WITH_WALLET_ORDER_TRANSFER_MISMATCH`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with order dest that does not match the custodial wallet's deposit address`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `transfer:TF_WITH_WALLET_ORDER_DEST_MISMATCH`,
          dest: `wallet:${stubCustodialWalletId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });
  });

  describe('custodial transfer callbacks', function () {
    this.beforeEach(async function () {
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, custodial_transfer_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          stubWalletOrderId,
          stubUserAddress.toLowerCase(),
          stubCustodialWalletId,
          stubCustodialTransferId,
          'received-order',
        ]
      );
    });

    it(`can provision a prepaid card after receiving custodial transfer callback when a reservation ID exists`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        stubSKU,
      ]);
      await db.query(`UPDATE wallet_orders SET reservation_id = $2 WHERE order_id = $1`, [
        stubWalletOrderId,
        stubReservationId,
      ]);

      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:${stubCustodialTransferId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(1);
      expect(waitForPrepaidCardTxnCallCount).to.equal(1);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('complete');
      let {
        rows: [{ transaction_hash: txnHash, prepaid_card_address: prepaidCardAddress }],
      } = await db.query(`SELECT * FROM reservations where id = $1`, [stubReservationId]);
      expect(txnHash).to.equal(stubProvisionTxnHash);
      expect(prepaidCardAddress).to.equal(stubPrepaidCardAddress);
    });

    it('can set an error-provisioning status when an error occurs during provisioning', async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        'boom',
      ]);
      await db.query(`UPDATE wallet_orders SET reservation_id = $2 WHERE order_id = $1`, [
        stubWalletOrderId,
        stubReservationId,
      ]);

      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:${stubCustodialTransferId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(1);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('error-provisioning');
      let {
        rows: [{ transaction_hash: txnHash, prepaid_card_address: prepaidCardAddress }],
      } = await db.query(`SELECT * FROM reservations where id = $1`, [stubReservationId]);
      expect(txnHash).to.equal(null);
      expect(prepaidCardAddress).to.equal(null);
    });

    it(`can transition to 'waiting-for-reservation' state after receiving custodial transfer callback when a reservation ID has not be received`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:${stubCustodialTransferId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('waiting-for-reservation');
    });

    it(`ignores callback related to an order ID that whose status is not "order-received"`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        stubSKU,
      ]);
      for (let status of ['waiting-for-order', 'waiting-for-reservation', 'complete']) {
        await db.query(`UPDATE wallet_orders SET reservation_id = $2, status = $3 WHERE order_id = $1`, [
          stubWalletOrderId,
          stubReservationId,
          status,
        ]);
        await post(`/callbacks/wyre`)
          .set('Content-Type', 'application/json')
          .set('Content-Type', 'application/json')
          .send({
            source: `wallet:${stubCustodialWalletId}`,
            dest: `transfer:${stubCustodialTransferId}`,
            currency: 'DAI',
            amount: 100,
            status: 'CONFIRMED',
          })
          .expect(204);

        expect(wyreService.wyreTransferCallCount).to.equal(0);
        expect(provisionPrepaidCardCallCount).to.equal(0);
        expect(waitForPrepaidCardTxnCallCount).to.equal(0);

        let {
          rows: [row],
        } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
        expect(row.status).to.equal(status);
      }
    });

    it(`ignores callback related to an order ID that does not exist in the DB`, async function () {
      await db.query(`DELETE FROM wallet_orders`);
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:${stubCustodialTransferId}`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with non-existent transfer ID`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:TF_DOES_NOT_EXIST`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback with non-completed transfer status`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:TF_PENDING`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback that has a transfer with a non-admin wallet destination`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:TF_NON_ADMIN_TRANSFER`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback that has a transfer source that does not match the callback request's source`, async function () {
      await post(`/callbacks/wyre`)
        .set('Content-Type', 'application/json')
        .set('Content-Type', 'application/json')
        .send({
          source: `wallet:${stubCustodialWalletId}`,
          dest: `transfer:TF_ADMIN_TRANSFER_SOURCE_MISMATCH`,
          currency: 'DAI',
          amount: 100,
          status: 'CONFIRMED',
        })
        .expect(204);

      expect(wyreService.wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);
      expect(waitForPrepaidCardTxnCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });
  });
});
