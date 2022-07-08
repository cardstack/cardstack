import { inject } from '@cardstack/di';
import { service } from '@cardstack/hub/services';
import Logger from '@cardstack/logger';
import { ValidatedWalletReceiveRequest } from '../routes/wyre-callback';
import * as Sentry from '@sentry/node';

let log = Logger('task:wyre-transfer');

interface WyreTransferPayload {
  request: ValidatedWalletReceiveRequest;
  dest: string;
}

export default class WyreTransferTask {
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  wyre = service('wyre');
  order = service('order');

  async perform(payload: WyreTransferPayload) {
    let { dest, request } = payload;
    let { wallet, transfer, order } = request;
    let { destAmount: amount, destCurrency: token } = transfer;
    log.info(
      `Running wyre transfer task for order ${order.id}: source=${wallet.id}, dest=${dest}, amount=${amount} token=${token}`
    );

    let { id: custodialTransferId } = await this.wyre.transfer(wallet.id, dest, amount, token);
    log.info(`Received successful wyre transfer for order ${order.id}: ${custodialTransferId}`);

    let db = await this.databaseManager.getClient();
    let { status: nextStatus } = await this.order.nextOrderStatus('wyre-receive-funds', order.id);
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
        [order.id, wallet.name.toLowerCase(), wallet.id, custodialTransferId, nextStatus]
      );
    } catch (err: any) {
      let message = `Error: Failed to upsert wallet-orders row for the ${wallet.id} receive of ${
        transfer.source
      }. Error is ${err.toString()}. request is: ${JSON.stringify(request, null, 2)}`;
      log.error(message, err);
      Sentry.captureException(err, {
        tags: {
          action: 'wyre-transfer',
        },
      });
      return;
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'wyre-transfer': WyreTransferTask;
  }
}
