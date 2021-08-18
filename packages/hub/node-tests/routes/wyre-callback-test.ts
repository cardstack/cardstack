import { Client as DBClient } from 'pg';
import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { bootServerForTesting } from '../../main';
import { Container } from '../../di/dependency-injection';
import { Registry } from '../../di/dependency-injection';
import { WyreOrder, WyreTransfer, WyreWallet } from '../../services/wyre';
import { adminWalletName } from '../../routes/wyre-callback';

class StubWyreService {
  async getWalletByUserAddress(userAddress: string): Promise<WyreWallet> {
    return Promise.resolve(handleGetWyreWalletByUserAddress(userAddress));
  }
  async getWalletById(walletId: string): Promise<WyreWallet> {
    return Promise.resolve(handleGetWyreWalletById(walletId));
  }
  async getTransfer(transferId: string): Promise<WyreTransfer> {
    return Promise.resolve(handleGetWyreTransfer(transferId));
  }
  async getOrder(orderId: string): Promise<WyreOrder> {
    return Promise.resolve(handleGetWyreOrder(orderId));
  }
  async transfer(source: string, dest: string, amount: number, token: string): Promise<WyreTransfer> {
    return Promise.resolve(handleWyreTransfer(source, dest, amount, token));
  }
}

class StubPrepaidCardInventory {
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
        ETH: stubDepositAddress,
      } as { [network: string]: string },
    };
  }
  return {
    id: 'WA_RANDOM_WALLET',
    name: 'random',
    callbackUrl: null,
    depositAddresses: {},
  };
}

function handleGetWyreTransfer(_transferId: string) {
  return {
    id: stubWalletOrderTransferId,
    status: 'COMPLETED' as 'COMPLETED',
    source: `walletorderholding:${stubWalletOrderId}`,
    dest: `wallet:${stubCustodialWalletId}`,
    sourceCurrency: 'DAI',
    destCurrency: 'DAI',
    destAmount: 100,
  };
}

function handleGetWyreOrder(_orderId: string) {
  return {
    id: stubWalletOrderId,
    status: 'COMPLETE' as 'COMPLETE',
    purchaseAmount: 100,
    sourceCurrency: 'USD',
    destCurrency: 'DAI',
    transferId: stubWalletOrderTransferId,
    dest: `ethereum:${stubDepositAddress}`,
  };
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

describe.only('POST /api/wyre-callback', function () {
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
        registry.register('prepaid-card-inventory', StubPrepaidCardInventory);
      },
      containerCallback(serverContainer: Container) {
        container = serverContainer;
      },
    });

    let dbManager = await container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM wallet_orders`);

    request = supertest(server);
  });

  this.afterEach(async function () {
    server.close();
  });

  describe('wallet order callbacks', function () {
    this.beforeEach(async function () {});

    it.only(`can process callback for wallet order that doesn't yet exist in DB`, async function () {
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
      expect(row.reservation_id).to.equal(null);
      expect(row.created_at).to.be.ok;
      expect(row.updated_at.valueOf()).to.equal(row.created_at.valueOf());
    });

    // This is the scenario where the reservationId/orderId correlation has been
    // set before the callback has been received
    it(`can process callback for wallet order that already exists in DB`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with an order ID that already exists and is in a completed state`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with non-existent wyre wallet ID`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with non-existent transfer ID`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with non-completed transfer status`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with transfer source that does not derive from a wallet order`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with transfer source that refers to non-existent wallet order`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with transfer ID that does not match the transfer ID associated with the wallet order`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with order dest that does not match the custodial wallet's deposit address`, async function () {
      expect(true).to.equal(false, 'TODO');
    });
  });

  describe('custodial transfer callbacks', function () {
    it(`can provision a prepaid card after receiving custodial transfer callback when a reservation ID exists`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`can transition to 'waiting-for-reservation' state after receiving custodial transfer callback when a reservation ID has not be received`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback related to an order ID that already exists and is in a completed state`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with non-existent transfer ID`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback with non-completed transfer status`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback that has a transfer with a non-admin wallet destination`, async function () {
      expect(true).to.equal(false, 'TODO');
    });

    it(`ignores callback that has a transfer source that does not match the callback request's source`, async function () {
      expect(true).to.equal(false, 'TODO');
    });
  });
});
