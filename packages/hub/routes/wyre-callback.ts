import Koa from 'koa';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import WyreService, { WyreOrder, WyreTransfer, WyreWallet } from '../services/wyre';
import Web3 from 'web3';
import { nextOrderStatus, OrderStatus, OrderState, provisionPrepaidCard, updateOrderStatus } from './utils/orders';

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

interface ValidatedWalletReceiveRequest {
  order: WyreOrder;
  transfer: WyreTransfer;
  wallet: WyreWallet;
}
interface ValidatedWalletSendRequest {
  orderId: string;
  reservationId: string | null;
  userAddress: string;
  transfer: WyreTransfer;
}

export const adminWalletName = 'admin';

export default class WyreCallbackRoute {
  adminWalletId: string | undefined;
  wyre: WyreService = inject('wyre');
  relay = inject('relay');
  subgraph = inject('subgraph');
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    let request = ctx.request.body;
    log.info(`Received wyre callback: ${JSON.stringify(request, null, 2)}`);
    try {
      assertWyreCallbackRequest(request);
    } catch (err) {
      log.info(
        `ignoring wyre callback that doesn't match the expected shape of a wyre callback request: ${JSON.stringify(
          request,
          null,
          2
        )}`
      );
      ctx.status = 400;
      return;
    }

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

    // we return no content because we don't want to leak any info to the caller
    // about our wallets/transfers/orders or any internal state.
    ctx.status = 204;
  }

  private async processWalletReceive(request: WyreCallbackRequest) {
    let validatedRequest = await this.validateWalletReceive(request);
    if (!validatedRequest) {
      return;
    }
    let { wallet, transfer, order } = validatedRequest;
    let { name: userAddress } = wallet;

    let { id: custodialTransferId } = await this.wyre.transfer(
      wallet.id,
      await this.getAdminWalletId(),
      transfer.destAmount,
      transfer.destCurrency
    );

    let db = await this.databaseManager.getClient();
    let { status: nextStatus } = await nextOrderStatus(db, 'wyre-receive-funds', order.id);
    // We use an upsert as there will be no guarantee you'll get the order
    // ID/reservation ID correlation from the card wallet before wyre calls the
    // webhook
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
           updated_at = now()`,
        [order.id, userAddress.toLowerCase(), wallet.id, custodialTransferId, nextStatus]
      );
    } catch (err) {
      log.error(
        `Error: Failed to upsert wallet-orders row for the ${request.dest} receive of ${
          transfer.source
        }. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
      );
      return;
    }
  }

  private async processWalletSend(request: WyreCallbackRequest) {
    let validatedRequest = await this.validateWalletSend(request);
    if (!validatedRequest) {
      return;
    }
    let { orderId, transfer } = validatedRequest;

    let db = await this.databaseManager.getClient();
    let state: OrderState, status: OrderStatus;
    try {
      ({ state, status } = await updateOrderStatus(db, orderId, 'wyre-send-funds'));
    } catch (err) {
      log.error(
        `Error: Failed to locate wallet_orders record for ${request.dest} receive of ${
          transfer.source
        }. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
      );
      return;
    }
    if (status === 'provisioning') {
      let { reservationId } = state;
      if (!reservationId) {
        log.error(`Encountered order ${orderId} in state provisioning without a reservation ID`);
        return;
      }
      try {
        await provisionPrepaidCard(db, this.relay, this.subgraph, reservationId);
      } catch (err) {
        log.error(
          `Could not provision prepaid card for reservationId ${reservationId}! Received error from relay server`,
          err
        );
        return;
      }
      await updateOrderStatus(db, orderId, 'provision-mined');
    }
  }

  private async validateWalletReceive(
    request: WyreCallbackRequest
  ): Promise<ValidatedWalletReceiveRequest | undefined> {
    let walletId = request.dest.split(':')[1];
    let wallet = await this.wyre.getWalletById(walletId);
    if (!wallet) {
      log.info(
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

    let db = await this.databaseManager.getClient();
    try {
      let result = await db.query(
        `SELECT status FROM wallet_orders WHERE order_id = $1 AND status != 'waiting-for-order'`,
        [orderId]
      );
      if (result.rows.length > 0) {
        log.info(
          `while processing ${request.dest} receive, transfer ${request.source}'s order ${orderId} has already been processed. skipping`
        );
        return;
      }
      result = await db.query(`SELECT user_address FROM wallet_orders WHERE order_id = $1`, [orderId]);
      if (result.rows.length > 0) {
        let {
          rows: [{ user_address: userAddress }],
        } = result;
        if (userAddress.toLowerCase() !== wallet.name.toLowerCase()) {
          log.info(
            `while processing ${request.dest} receive, transfer ${request.source}'s order ${orderId}, the related wallet ${wallet.id} is associated to a user address ${wallet.name} that is different than the user address the client already informed us about ${userAddress}. skipping`
          );
          return;
        }
      }
    } catch (err) {
      log.error(
        `Error: while processing ${
          request.dest
        } receive, failed to query for wallet_orders record with an order ID of ${orderId}, for ${
          request.dest
        } receive of ${transfer.source}. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
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

    let { depositAddresses } = wallet;
    if (!depositAddresses || !order.dest.toLowerCase().endsWith(depositAddresses.ETH.toLowerCase())) {
      // this is could be a spoofed callback from wyre
      log.info(
        `while processing ${request.dest} receive, ignoring wallet receive for wallet order whose destination ${order.dest} does not match the custodial wallet deposit address ${depositAddresses?.ETH}`
      );
      return;
    }

    return {
      order,
      transfer,
      wallet,
    };
  }

  private async validateWalletSend(request: WyreCallbackRequest): Promise<ValidatedWalletSendRequest | undefined> {
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

    let db = await this.databaseManager.getClient();
    let orders: { id: string; reservationId: string; userAddress: string }[] = [];
    try {
      let result = await db.query(
        `SELECT order_id, reservation_id, user_address FROM wallet_orders WHERE custodial_transfer_id = $1 AND status = 'received-order'`,
        [transferId]
      );
      orders = result.rows.map((row) => ({
        id: row.order_id,
        reservationId: row.reservation_id,
        userAddress: toChecksumAddress(row.user_address),
      }));
    } catch (err) {
      log.error(
        `Error: Failed to locate wallet_orders record for ${request.dest} receive of ${
          transfer.source
        }. request is: ${JSON.stringify(request.source, null, 2)}`,
        err
      );
      return;
    }

    let [order] = orders;
    if (!order) {
      log.info(
        `while processing ${
          request.source
        } send to admin account, could not find wallet_orders with a status of "received-order" that correlate to the request with custodial transfer ID of ${transferId}. request is: ${JSON.stringify(
          request.source,
          null,
          2
        )}`
      );
      return;
    }

    return {
      orderId: order.id,
      reservationId: order.reservationId,
      userAddress: order.userAddress,
      transfer,
    };
  }

  private async getAdminWalletId(): Promise<string> {
    if (!this.adminWalletId) {
      let adminWallet = await this.wyre.getWalletByUserAddress(adminWalletName); // this address has a very special name
      this.adminWalletId = adminWallet?.id;
    }
    if (!this.adminWalletId) {
      log.error(
        'Error: Wyre admin wallet has not been created! Please create a wyre admin wallet with the name "admin" that has no callback URL.'
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
