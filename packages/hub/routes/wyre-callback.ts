import Koa from 'koa';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import WyreService, { WyreTransfer } from '../services/wyre';
import Web3 from 'web3';

const { toChecksumAddress } = Web3.utils;
let log = Logger('route:wyre-callback');

interface WyreCallbackRequest {
  id: string;
  source: string;
  dest: string;
  currency: string;
  amount: number;
  status: WyreTransfer['status'];
  createdAt: number;
}

export const adminWalletName = 'admin';

export default class WyreCallbackRoute {
  adminWalletId: string | undefined;
  wyre: WyreService = inject('wyre');
  prepaidCardInventory = inject('prepaid-card-inventory', { as: 'prepaidCardInventory' });
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    let request = ctx.request.body;
    log.info(`Received wyre callback: ${JSON.stringify(request, null, 2)}`);
    // it should be ok to throw here since this means something that is not wyre
    // is calling us
    assertWyreCallbackRequest(request);

    let [sourceType] = request.source.split(':');
    let [destType] = request.dest.split(':');

    // keep in mind these are server callbacks so we should be pretty forgiving
    // with erronous data and just log extensively
    if (sourceType === 'transfer' && destType === 'wallet') {
      await this.processWalletReceive(request);
    } else if (sourceType === 'wallet' && destType === 'transfer') {
      await this.processWalletSend(request);
    } else {
      // this is some other thing we don't care about
      log.info(`ignoring wyre callback with source ${request.source} and dest ${request.dest}`);
    }

    ctx.status = 204;
  }

  private async processWalletReceive(request: WyreCallbackRequest) {
    // First we want to validate all our callback data inputs with wyre to make
    // sure we are not being spoofed
    let walletId = request.dest.split(':')[1];
    let { name: userAddress, depositAddresses } = (await this.wyre.getWalletById(walletId)) ?? {};
    if (!userAddress) {
      log.error(
        `while processing ${request.dest} receive, could not resolve user address for wyre wallet ID ${walletId}`
      );
      return;
    }

    let transferId = request.source.split(':')[1];
    let transfer = await this.wyre.getTransfer(transferId);
    if (!transfer) {
      log.info(`while processing ${request.dest} receive, could not find transfer for transferId ${request.source}`);
      return;
    }
    if (transfer.status !== 'COMPLETED') {
      log.info(
        `while processing ${request.dest} receive, transfer status for transferId ${request.source} is not COMPLETED it is ${transfer.status}`
      );
      return;
    }

    let orderId = transfer.source.split(':')[1];
    // all wyre wallet order ID's start with "WO_"
    if (!orderId.startsWith('WO_')) {
      log.trace(
        `while processing ${request.dest} receive, source for ${transferId} is not a wallet order, ${transfer.source}. skipping`
      );
      return;
    }

    let order = await this.wyre.getOrder(orderId);
    if (!order) {
      log.info(`while processing ${request.dest} receive, could not find order for orderId ${transfer.source}`);
      return;
    }

    if (!request.source.endsWith(order.transferId)) {
      // this is could be a spoofed callback from wyre
      log.info(
        `while processing ${request.dest} receive, ignoring wallet receive for transfer, transfer ${request.source} does not match ${transfer.source}'s transferId ${order.transferId}`
      );
      return;
    }
    if (!depositAddresses || !order.dest.toLowerCase().endsWith(depositAddresses.ETH.toLowerCase())) {
      // this is could be a spoofed callback from wyre
      log.info(
        `while processing ${request.dest} receive, ignoring wallet receive for wallet order whose destination ${order.dest} does not match the custodial wallet deposit address ${depositAddresses?.ETH}`
      );
      return;
    }

    let { id: custodialTransferId } = await this.wyre.transfer(
      walletId,
      await this.getAdminWalletId(),
      transfer.destAmount,
      transfer.destCurrency
    );

    // We use an upsert as there will be no guarantee you'll get the order
    // ID/reservation ID correlation from the card wallet before wyre calls the
    // webhook
    let db = await this.databaseManager.getClient();
    try {
      await db.query(
        `INSERT INTO wallet_orders (
           order_id, user_address, wallet_id, custodial_transfer_id, status
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id)
         DO UPDATE SET
           user_address = $2,
           wallet_id = $3,
           custodial_transfer_id = $4,
           status = $5,
           updated_at = NOW()`,
        [orderId, userAddress, walletId, custodialTransferId, 'received-order']
      );
    } catch (err) {
      log.error(
        `Failed to upsert wallet-orders row for the ${request.dest} receive of ${
          transfer.source
        }. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
      );
    }
  }

  private async processWalletSend(request: WyreCallbackRequest) {
    let transferId = request.dest.split(':')[1];
    let transfer = await this.wyre.getTransfer(transferId);
    if (!transfer) {
      log.info(`while processing ${request.source} send, could not find transfer for transferId ${request.dest}`);
      return;
    }
    if (transfer.status !== 'COMPLETED') {
      log.info(
        `while processing ${request.source} send, transfer status for transferId ${request.dest} is not COMPLETED, it is: ${transfer.status}`
      );
      return;
    }

    if (!(transfer.dest.endsWith(await this.getAdminWalletId()) && transfer.source === request.source)) {
      // this is some other thing we don't care about or a spoofed callback
      log.info(`while processing ${request.source} send, ignoring wallet send for transfer ${request.dest}`);
      return;
    }

    // The funds from the custodial wallet have been moved into our admin
    // wallet. It should be impossible to get here without first having
    // encountered the webhook call for the receipt of the funds into the
    // custodial wallet.
    let db = await this.databaseManager.getClient();
    let orders: { id: string; reservationId: string; userAddress: string }[] = [];
    try {
      let result = await db.query(
        `SELECT order_id, reservation_id, user_address FROM wallet_orders WHERE custodial_transfer_id`,
        [transferId]
      );
      orders = result.rows.map((row) => ({
        id: row.order_id,
        reservationId: row.reservation_id,
        userAddress: toChecksumAddress(row.user_address),
      }));
    } catch (err) {
      log.error(
        `Failed to locate wallet_orders record for ${request.dest} receive of ${
          transfer.source
        }. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
      );
    }

    let [order] = orders;
    if (!order) {
      log.error(
        `while processing ${
          request.source
        } send to admin account, could not find pending wallet_orders that correlate to the request with custodial transfer ID of ${transferId}. request is: ${JSON.stringify(
          request.source,
          null,
          2
        )}`
      );
    }

    try {
      await db.query(`UPDATE wallet_orders SET status = $2 WHERE order_id = $1`, [
        order.id,
        order.reservationId ? 'complete' : 'waiting-for-reservation',
      ]);
    } catch (err) {
      log.error(
        `Failed to locate wallet_orders record for ${request.dest} receive of ${
          transfer.source
        }. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
      );
    }

    if (order.reservationId) {
      log.info(`provisioning prepaid card for user ${order.userAddress} with reservation ID ${order.reservationId}`);
      await this.prepaidCardInventory.provisionPrepaidCard(order.userAddress, order.reservationId);
    } else {
      log.info(
        `while processing ${request.source} send to admin account for order id ${order.id}, still haven't received a reservation ID for this order from the client. Waiting for reservation`
      );
    }
  }

  private async getAdminWalletId(): Promise<string> {
    if (!this.adminWalletId) {
      let adminWallet = await this.wyre.getWalletByUserAddress(adminWalletName); // this address has a very special name
      this.adminWalletId = adminWallet?.id;
    }
    if (!this.adminWalletId) {
      log.error(
        'Wyre admin wallet has not been created! Please create a wyre admin wallet with the name "admin" that has no callback URL.'
      );
      throw new Error('Wyre admin wallet has not been created');
    }
    return this.adminWalletId;
  }
}

function assertWyreCallbackRequest(request: any): asserts request is WyreCallbackRequest {
  if (typeof request !== 'object') {
    throw new Error(`object is not WyreCallbackRequest, expecting type object but was ${typeof request}`);
  }
  if (
    !('source' in request) ||
    !('dest' in request) ||
    !('currency' in request) ||
    !('amount' in request) ||
    !('status' in request)
  ) {
    throw new Error(
      `object is not WyreCallbackRequest, expecting to find properties: "source", "dest", "currency", "amount", "status"  but found: ${Object.keys(
        request
      ).join(', ')}`
    );
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'wyre-callback-route': WyreCallbackRoute;
  }
}
