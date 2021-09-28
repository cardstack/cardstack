import Koa from 'koa';
import config from 'config';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import WyreService, { WyreOrder, WyreTransfer, WyreWallet } from '../services/wyre';
import Web3 from 'web3';
import { nextOrderStatus, OrderStatus, OrderState, provisionPrepaidCard, updateOrderStatus } from './utils/orders';
import * as Sentry from '@sentry/node';
import { captureSentryMessage } from './utils/sentry';

const { toChecksumAddress } = Web3.utils;
let log = Logger('route:wyre-callback');
const env = config.get('hubEnvironment') as string;

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

export const adminWalletName = `${env}_admin`;

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
      let message = `ignoring wyre callback that doesn't match the expected shape of a wyre callback request: ${JSON.stringify(
        request,
        null,
        2
      )}`;
      log.info(message);
      captureSentryMessage(message, ctx);
      ctx.status = 400;
      return;
    }

    let [sourceType] = request.source.split(':');
    let [destType] = request.dest.split(':');

    // keep in mind these are server callbacks so we should be pretty forgiving
    // with erronous data and just log extensively
    if (sourceType === 'transfer' && destType === 'wallet') {
      Sentry.addBreadcrumb({ message: `wyre callback - custodial wallet receive: ${JSON.stringify(request)}` });
      await this.processWalletReceive(request, ctx);
    } else if (sourceType === 'wallet' && destType === 'transfer') {
      Sentry.addBreadcrumb({ message: `wyre callback - custodial wallet send: ${JSON.stringify(request)}` });
      await this.processWalletSend(request, ctx);
    } else {
      // this is some other thing we don't care about
      Sentry.addBreadcrumb({ message: `wyre callback - unknown reason: ${JSON.stringify(request)}` });
      log.info(`ignoring wyre callback with source ${request.source} and dest ${request.dest}`);
    }

    // we return no content because we don't want to leak any info to the caller
    // about our wallets/transfers/orders or any internal state.
    ctx.status = 204;
  }

  private async processWalletReceive(request: WyreCallbackRequest, ctx: Koa.Context) {
    let validatedRequest = await this.validateWalletReceive(request);
    if (!validatedRequest) {
      captureSentryMessage(`wyre callback request failed validation: ${JSON.stringify(request)}`, ctx);
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
      let message = `Error: Failed to upsert wallet-orders row for the ${request.dest} receive of ${
        transfer.source
      }. Error is ${err.toString()}. request is: ${JSON.stringify(request.source, null, 2)}`;
      log.error(message, err);
      captureSentryMessage(message, ctx);
      return;
    }
  }

  private async processWalletSend(request: WyreCallbackRequest, ctx: Koa.Context) {
    let validatedRequest = await this.validateWalletSend(request);
    if (!validatedRequest) {
      captureSentryMessage(`wyre callback request failed validation: ${JSON.stringify(request)}`, ctx);
      return;
    }
    let { orderId, transfer } = validatedRequest;

    let db = await this.databaseManager.getClient();
    let state: OrderState, status: OrderStatus;
    try {
      ({ state, status } = await updateOrderStatus(db, orderId, 'wyre-send-funds'));
    } catch (err) {
      let message = `Error: Failed to locate wallet_orders record for ${request.dest} receive of ${
        transfer.source
      }. Error is ${err.toString()}. request is: ${JSON.stringify(request.source, null, 2)}`;
      log.error(message, err);
      captureSentryMessage(message, ctx);
      return;
    }
    if (status === 'provisioning') {
      let { reservationId } = state;
      if (!reservationId) {
        let message = `Encountered order ${orderId} in state provisioning without a reservation ID`;
        log.error(message);
        captureSentryMessage(message, ctx);
        return;
      }
      try {
        Sentry.addBreadcrumb({ message: `provisioning prepaid card for reservationId=${reservationId}` });
        await provisionPrepaidCard(db, this.relay, this.subgraph, reservationId);
      } catch (err) {
        let message = `Could not provision prepaid card for reservationId ${reservationId}! Received error from relay server: ${err.toString()}`;
        log.error(message, err);
        captureSentryMessage(message, ctx);
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
      let message = `while processing ${request.dest} receive, could not resolve user address for wyre wallet ID ${walletId}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }

    let transferId = request.source.split(':')[1];
    let transfer = await this.wyre.getTransfer(transferId);
    if (!transfer) {
      let message = `while processing ${request.dest} receive, could not find transfer for transferId ${request.source}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }
    if (transfer.status !== 'COMPLETED') {
      let message = `while processing ${request.dest} receive, transfer status for transferId ${request.source} is not COMPLETED it is ${transfer.status}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }

    let orderId = transfer.source.split(':')[1];
    // all wyre wallet order ID's start with "WO_"
    if (!orderId.startsWith('WO_')) {
      let message = `while processing ${request.dest} receive, source for ${transferId} is not a wallet order, ${transfer.source}. skipping`;
      log.trace(message);
      Sentry.addBreadcrumb({ message });
      return;
    }

    let db = await this.databaseManager.getClient();
    try {
      let result = await db.query(
        `SELECT status FROM wallet_orders WHERE order_id = $1 AND status != 'waiting-for-order'`,
        [orderId]
      );
      if (result.rows.length > 0) {
        let message = `while processing ${request.dest} receive, transfer ${request.source}'s order ${orderId} has already been processed. skipping`;
        log.info(message);
        Sentry.addBreadcrumb({ message });
        return;
      }
      result = await db.query(`SELECT user_address FROM wallet_orders WHERE order_id = $1`, [orderId]);
      if (result.rows.length > 0) {
        let {
          rows: [{ user_address: userAddress }],
        } = result;
        if (userAddress.toLowerCase() !== wallet.name.toLowerCase()) {
          let message = `while processing ${request.dest} receive, transfer ${request.source}'s order ${orderId}, the related wallet ${wallet.id} is associated to a user address ${wallet.name} that is different than the user address the client already informed us about ${userAddress}. skipping`;
          log.info(message);
          Sentry.addBreadcrumb({ message });
          return;
        }
      }
    } catch (err) {
      let message = `Error: while processing ${
        request.dest
      } receive, failed to query for wallet_orders record with an order ID of ${orderId}, for ${
        request.dest
      } receive of ${transfer.source}. Error: ${err.toString()}. request is: ${JSON.stringify(
        request.source,
        null,
        2
      )}`;
      log.error(message, err);
      Sentry.addBreadcrumb({ message });
      return;
    }

    let order = await this.wyre.getOrder(orderId);
    if (!order) {
      let message = `while processing ${request.dest} receive, could not find order for orderId ${transfer.source}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }

    if (!request.source.endsWith(order.transferId)) {
      // this is could be a spoofed callback from wyre
      let message = `while processing ${request.dest} receive, ignoring wallet receive for transfer, transfer ${request.source} does not match ${transfer.source}'s transferId ${order.transferId}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }

    let { depositAddresses } = wallet;
    if (!depositAddresses || !order.dest.toLowerCase().endsWith(depositAddresses.ETH.toLowerCase())) {
      // this is could be a spoofed callback from wyre
      let message = `while processing ${request.dest} receive, ignoring wallet receive for wallet order whose destination ${order.dest} does not match the custodial wallet deposit address ${depositAddresses?.ETH}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
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
      let message = `while processing ${request.source} send, could not find transfer for transferId ${request.dest}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }
    if (transfer.status !== 'COMPLETED') {
      let message = `while processing ${request.source} send, transfer status for transferId ${request.dest} is not COMPLETED, it is: ${transfer.status}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
      return;
    }

    if (!(transfer.dest.endsWith(await this.getAdminWalletId()) && transfer.source === request.source)) {
      // this is some other thing we don't care about or a spoofed callback
      let message = `while processing ${request.source} send, ignoring wallet send for transfer ${request.dest}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });
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
      let message = `Error: Failed to locate wallet_orders record for ${request.dest} receive of ${
        transfer.source
      }. Error is ${err.toString()}. request is: ${JSON.stringify(request.source, null, 2)}`;
      log.error(message, err);
      Sentry.addBreadcrumb({ message });
      return;
    }

    let [order] = orders;
    if (!order) {
      let message = `while processing ${
        request.source
      } send to admin account, could not find wallet_orders with a status of "received-order" that correlate to the request with custodial transfer ID of ${transferId}. request is: ${JSON.stringify(
        request.source,
        null,
        2
      )}`;
      log.info(message);
      Sentry.addBreadcrumb({ message });

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
      let message = `Error: Wyre admin wallet has not been created! Please create a wyre admin wallet with the name "${adminWalletName}" that has no callback URL.`;
      log.error(message);
      Sentry.addBreadcrumb({ message });
      throw new Error(`Wyre admin wallet, ${adminWalletName}, has not been created`);
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
    let message = `object is not WyreCallbackRequest, expecting to find properties: "source", "dest", "currency", "amount", "status"  but found: ${Object.keys(
      request
    ).join(', ')}`;
    Sentry.addBreadcrumb({ message });
    throw new Error(message);
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'wyre-callback-route': WyreCallbackRoute;
  }
}
