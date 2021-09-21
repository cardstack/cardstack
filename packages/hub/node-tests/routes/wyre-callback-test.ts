import { Client as DBClient } from 'pg';
import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { bootServerForTesting } from '../../main';
import { Container } from '../../di/dependency-injection';
import { Registry } from '../../di/dependency-injection';
import { WyreOrder, WyreTransfer, WyreWallet } from '../../services/wyre';
import { adminWalletName } from '../../routes/wyre-callback';

class StubWyreService {
  async getWalletByUserAddress(userAddress: string): Promise<WyreWallet | undefined> {
    return Promise.resolve(handleGetWyreWalletByUserAddress(userAddress));
  }
  async getWalletById(walletId: string): Promise<WyreWallet | undefined> {
    return Promise.resolve(handleGetWyreWalletById(walletId));
  }
  async getTransfer(transferId: string): Promise<WyreTransfer | undefined> {
    return Promise.resolve(handleGetWyreTransfer(transferId));
  }
  async getOrder(orderId: string): Promise<WyreOrder | undefined> {
    return Promise.resolve(handleGetWyreOrder(orderId));
  }
  async transfer(source: string, dest: string, amount: number, token: string): Promise<WyreTransfer | undefined> {
    return Promise.resolve(handleWyreTransfer(source, dest, amount, token));
  }
}

class StubRelayService {
  async provisionPrepaidCard(userAddress: string, reservationId: string) {
    return Promise.resolve(handleProvisionPrepaidCard(userAddress, reservationId));
  }
}

// these ID prefixes are part of wyre's own ID scheme
const adminWalletId = 'WA_ADMIN_WALLET';
const stubCustodialWalletId = 'WA_CUSTODIAL_WALLET';
const stubWalletOrderTransferId = 'TF_WALLET_ORDER';
const stubCustodialTransferId = 'TF_CUSTODIAL_TRANSFER';
const stubWalletOrderId = 'WO_WALLET_ORDER';
const stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
const stubDepositAddress = '0x59faede86fb650d956ca633a5c1a21fa53fe151c'; // wyre always returns lowercase addresses
const randomAddress = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';
const stubReservationId = '0x1234565';

let wyreTransferCallCount = 0;
let provisionPrepaidCardCallCount = 0;

function handleGetWyreWalletByUserAddress(userAddress: string) {
  if (userAddress === adminWalletName) {
    return {
      id: adminWalletId,
      name: adminWalletName,
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
}

function handleGetWyreWalletById(walletId: string) {
  if (walletId === stubCustodialWalletId) {
    return {
      id: stubCustodialWalletId,
      name: stubUserAddress.toLowerCase(),
      callbackUrl: null,
      depositAddresses: {
        ETH: stubDepositAddress, // eslint-disable-line @typescript-eslint/naming-convention
      } as { [network: string]: string },
    };
  } else if (walletId === 'WA_DOES_NOT_EXIST') {
    return;
  }

  return {
    id: 'WA_RANDOM_WALLET',
    name: 'random',
    callbackUrl: null,
    depositAddresses: {},
  };
}

function handleGetWyreTransfer(transferId: string) {
  switch (transferId) {
    case stubWalletOrderTransferId:
      return {
        id: stubWalletOrderTransferId,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:${stubWalletOrderId}`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case stubCustodialTransferId:
      return {
        id: stubCustodialTransferId,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:${stubCustodialWalletId}`,
        dest: `wallet:${adminWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case 'TF_PENDING':
      return {
        id: 'TF_PENDING',
        status: 'PENDING' as 'PENDING',
        source: `wallet:${stubCustodialWalletId}`,
        dest: `wallet:${adminWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_NON_WALLET_ORDER_SOURCE`:
      return {
        id: `TF_NON_WALLET_ORDER_SOURCE`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:${adminWalletId}`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_NON_EXISTENT_WALLET_ORDER_SOURCE`:
      return {
        id: `TF_NON_EXISTENT_WALLET_ORDER_SOURCE`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:WO_DOES_NOT_EXIST`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_WITH_WALLET_ORDER_TRANSFER_MISMATCH`:
      return {
        id: `TF_WITH_WALLET_ORDER_TRANSFER_MISMATCH`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:WO_TRANSFER_MISMATCH`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_WITH_WALLET_ORDER_DEST_MISMATCH`:
      return {
        id: `TF_WITH_WALLET_ORDER_DEST_MISMATCH`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `walletorderholding:WO_DEST_MISMATCH`,
        dest: `wallet:${stubCustodialWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_NON_ADMIN_TRANSFER`:
      return {
        id: `TF_NON_ADMIN_TRANSFER`,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:${stubCustodialWalletId}`,
        dest: `wallet:WA_NON_ADMIN_WALLET`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
    case `TF_ADMIN_TRANSFER_SOURCE_MISMATCH`:
      return {
        id: stubCustodialTransferId,
        status: 'COMPLETED' as 'COMPLETED',
        source: `wallet:WA_RANDOM_WALLET`,
        dest: `wallet:${adminWalletId}`,
        sourceCurrency: 'DAI',
        destCurrency: 'DAI',
        destAmount: 100,
      };
  }
  return;
}

function handleGetWyreOrder(orderId: string) {
  switch (orderId) {
    case stubWalletOrderId:
      return {
        id: stubWalletOrderId,
        status: 'COMPLETE' as 'COMPLETE',
        purchaseAmount: 100,
        sourceCurrency: 'USD',
        destCurrency: 'DAI',
        transferId: stubWalletOrderTransferId,
        dest: `ethereum:${stubDepositAddress}`,
      };
    case 'WO_TRANSFER_MISMATCH':
      return {
        id: 'WO_TRANSFER_MISMATCH',
        status: 'COMPLETE' as 'COMPLETE',
        purchaseAmount: 100,
        sourceCurrency: 'USD',
        destCurrency: 'DAI',
        transferId: 'TF_MISMATCHED_TRANSFER',
        dest: `ethereum:${stubDepositAddress}`,
      };
    case 'WO_DEST_MISMATCH':
      return {
        id: 'WO_DEST_MISMATCH',
        status: 'COMPLETE' as 'COMPLETE',
        purchaseAmount: 100,
        sourceCurrency: 'USD',
        destCurrency: 'DAI',
        transferId: `TF_WITH_WALLET_ORDER_DEST_MISMATCH`,
        dest: `ethereum:${randomAddress}`,
      };
  }
  return;
}

function handleWyreTransfer(source: string, dest: string, amount: number, token: string) {
  wyreTransferCallCount++;

  expect(source).to.equal(stubCustodialWalletId);
  expect(dest).to.equal(adminWalletId);
  expect(amount).to.equal(100);
  expect(token).to.equal('DAI');

  return {
    id: stubCustodialTransferId,
    status: 'COMPLETED' as 'COMPLETED',
    source: `wallet:${source}`,
    dest: `wallet:${dest}`,
    sourceCurrency: token,
    destCurrency: token,
    destAmount: amount,
  };
}

function handleProvisionPrepaidCard(userAddress: string, reservationId: string) {
  provisionPrepaidCardCallCount++;
  expect(userAddress).to.equal(stubUserAddress);
  expect(reservationId).to.equal(stubReservationId);
}

describe('POST /api/wyre-callback', function () {
  let server: Server;
  let db: DBClient;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    let container!: Container;
    wyreTransferCallCount = 0;
    provisionPrepaidCardCallCount = 0;

    server = await bootServerForTesting({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('wyre', StubWyreService);
        registry.register('relay', StubRelayService);
      },
      containerCallback(serverContainer: Container) {
        container = serverContainer;
      },
    });

    let dbManager = await container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM wallet_orders`);
    await db.query(`DELETE FROM reservations`);

    request = supertest(server);
  });

  this.afterEach(async function () {
    server.close();
  });

  it(`returns 400 when the shape of the request does not match the expected format`, async function () {
    await request
      .post(`/callbacks/wyre`)
      .set('Content-Type', 'application/json')
      .set('Content-Type', 'application/json')
      .send({
        not: 'a valid callback request',
      })
      .expect(400);
  });

  describe('wallet order callbacks', function () {
    it(`can process callback for wallet order that doesn't yet exist in DB`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(1);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(1);

      let [row] = rows;
      expect(row.user_address).to.equal(stubUserAddress.toLowerCase());
      expect(row.wallet_id).to.equal(stubCustodialWalletId);
      expect(row.custodial_transfer_id).to.equal(stubCustodialTransferId);
      expect(row.status).to.equal('received-order');
    });

    // This is the scenario where the reservationId/orderId correlation has been
    // set before the callback has been received
    it(`can process callback for pending wallet order that we already received a prepaid card reservation for`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        'sku1',
      ]);
      await db.query(
        `INSERT INTO wallet_orders (order_id, user_address, wallet_id, reservation_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          stubWalletOrderId,
          stubUserAddress.toLowerCase(),
          stubCustodialWalletId,
          stubReservationId,
          'waiting-for-order',
        ]
      );
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(1);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(1);

      let [row] = rows;
      expect(row.user_address).to.equal(stubUserAddress.toLowerCase());
      expect(row.wallet_id).to.equal(stubCustodialWalletId);
      expect(row.custodial_transfer_id).to.equal(stubCustodialTransferId);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback with an order ID that already exists and is not in a "waiting-for-order" state`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        'sku1',
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

        await request
          .post(`/callbacks/wyre`)
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

        expect(wyreTransferCallCount).to.equal(0);
        expect(provisionPrepaidCardCallCount).to.equal(0);

        let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
        expect(rows.length).to.equal(1);
      }
    });

    it(`ignores callback with non-existent wyre wallet ID`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with non-existent transfer ID`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with non-completed transfer status`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with transfer source that does not derive from a wallet order`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with transfer source that refers to non-existent wallet order`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with transfer ID that does not match the transfer ID associated with the wallet order`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with order dest that does not match the custodial wallet's deposit address`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

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
        'sku1',
      ]);
      await db.query(`UPDATE wallet_orders SET reservation_id = $2 WHERE order_id = $1`, [
        stubWalletOrderId,
        stubReservationId,
      ]);

      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(1);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('complete');
    });

    it(`can transition to 'waiting-for-reservation' state after receiving custodial transfer callback when a reservation ID has not be received`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('waiting-for-reservation');
    });

    it(`ignores callback related to an order ID that whose status is not "order-received"`, async function () {
      await db.query(`INSERT INTO reservations (id, user_address, sku) VALUES ($1, $2, $3)`, [
        stubReservationId,
        stubUserAddress.toLowerCase(),
        'sku1',
      ]);
      for (let status of ['waiting-for-order', 'waiting-for-reservation', 'complete']) {
        await db.query(`UPDATE wallet_orders SET reservation_id = $2, status = $3 WHERE order_id = $1`, [
          stubWalletOrderId,
          stubReservationId,
          status,
        ]);
        await request
          .post(`/callbacks/wyre`)
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

        expect(wyreTransferCallCount).to.equal(0);
        expect(provisionPrepaidCardCallCount).to.equal(0);

        let {
          rows: [row],
        } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
        expect(row.status).to.equal(status);
      }
    });

    it(`ignores callback related to an order ID that does not exist in the DB`, async function () {
      await db.query(`DELETE FROM wallet_orders`);
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(rows.length).to.equal(0);
    });

    it(`ignores callback with non-existent transfer ID`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback with non-completed transfer status`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback that has a transfer with a non-admin wallet destination`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });

    it(`ignores callback that has a transfer source that does not match the callback request's source`, async function () {
      await request
        .post(`/callbacks/wyre`)
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

      expect(wyreTransferCallCount).to.equal(0);
      expect(provisionPrepaidCardCallCount).to.equal(0);

      let {
        rows: [row],
      } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
      expect(row.status).to.equal('received-order');
    });
  });
});
