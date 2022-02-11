import { Client as DBClient } from 'pg';
import WyreTransferTask from '../../tasks/wyre-transfer';
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

const stubSKU = 'sku1';
const stubReservationId = uuidv4();

describe('wyre-transfer-task', function () {
  let db: DBClient;
  let wyreService: StubWyreService;

  this.beforeEach(function () {
    registry(this).register('wyre', StubWyreService);
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    wyreService = (await getContainer().lookup('wyre')) as unknown as StubWyreService;
    wyreService.wyreTransferCallCount = 0;

    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM wallet_orders`);
    await db.query(`DELETE FROM reservations`);
  });

  it(`can process callback for wallet order that doesn't yet exist in DB`, async function () {
    let task = (await getContainer().lookup('wyre-transfer')) as WyreTransferTask;
    await task.perform({
      request: {
        wallet: (await wyreService.getWalletById(stubCustodialWalletId))!,
        order: (await wyreService.getOrder(stubWalletOrderId))!,
        transfer: (await wyreService.getTransfer(stubWalletOrderTransferId))!,
      },
      dest: adminWalletId,
    });

    expect(wyreService.wyreTransferCallCount).to.equal(1);

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
      stubSKU,
    ]);
    await db.query(
      `INSERT INTO wallet_orders (order_id, user_address, wallet_id, reservation_id, status) VALUES ($1, $2, $3, $4, $5)`,
      [stubWalletOrderId, stubUserAddress.toLowerCase(), stubCustodialWalletId, stubReservationId, 'waiting-for-order']
    );
    let task = (await getContainer().lookup('wyre-transfer')) as WyreTransferTask;
    await task.perform({
      request: {
        wallet: (await wyreService.getWalletById(stubCustodialWalletId))!,
        order: (await wyreService.getOrder(stubWalletOrderId))!,
        transfer: (await wyreService.getTransfer(stubWalletOrderTransferId))!,
      },
      dest: adminWalletId,
    });

    expect(wyreService.wyreTransferCallCount).to.equal(1);

    let { rows } = await db.query(`SELECT * FROM wallet_orders where order_id = $1`, [stubWalletOrderId]);
    expect(rows.length).to.equal(1);

    let [row] = rows;
    expect(row.user_address).to.equal(stubUserAddress.toLowerCase());
    expect(row.wallet_id).to.equal(stubCustodialWalletId);
    expect(row.custodial_transfer_id).to.equal(stubCustodialTransferId);
    expect(row.status).to.equal('received-order');
  });
});
