import { Client as DBClient } from 'pg';
import Web3 from 'web3';
import RelayService from '../../services/relay';
import Subgraph from '../../services/subgraph';

const { toChecksumAddress } = Web3.utils;

export type OrderStatus =
  | 'waiting-for-order'
  | 'received-order'
  | 'waiting-for-reservation'
  | 'provisioning'
  | 'error-provisioning'
  | 'complete';
export type OrderEvent =
  | 'received-reservation'
  | 'wyre-receive-funds'
  | 'wyre-send-funds'
  | 'provision-error'
  | 'provision-mined';
export interface OrderState {
  reservationId: string | null;
}

/* State machine for order status:

     {START}
       |  \
       |   \  received-reservation
       |    \
       |     V
       |    {WAITING-FOR-ORDER}
wyre   |           \
receive|            \  wyre-receive-funds
funds  |             \         ______
       |              V       /      \  received
       |------> {RECEIVED-ORDER}      | reservation
                   /       |  ^______/
                  /        |
wyre-send-funds  /         |
reservationId == null      |
               /           |
              V            | wyre-send-funds
{WAITING-FOR-RESERVATION}  | reservationId != null
              \            |
  received     \           |
  reservation   \          |
                 V         V
                {PROVISIONING}
                     /    \
  provisioned-mined /      \ provision-error
                   /        \
                  V          V
             {COMPLETE}    {ERROR-PROVISIONING}

*/
export async function nextOrderStatus(
  db: DBClient,
  event: OrderEvent,
  orderId: string
): Promise<{ status: OrderStatus; state: OrderState }> {
  let state: OrderState = { reservationId: null };
  let { rows } = await db.query(`SELECT status, reservation_id FROM wallet_orders WHERE order_id = $1`, [orderId]);
  if (rows.length === 0) {
    if (event === 'received-reservation') {
      return { status: 'waiting-for-order', state };
    } else if (event === 'wyre-receive-funds') {
      return { status: 'received-order', state };
    } else {
      throw unhandledEvent(event, orderId);
    }
  }

  let [{ status: currentStatus, reservation_id: reservationId }] = rows;
  state.reservationId = reservationId;
  assertOrderStatus(currentStatus, orderId);

  switch (currentStatus) {
    case 'waiting-for-order':
      if (event === 'wyre-receive-funds') {
        return { status: 'received-order', state };
      }
      throw unhandledEvent(event, orderId, currentStatus);
    case 'received-order':
      if (event === 'received-reservation') {
        return { status: 'received-order', state };
      }
      if (event === 'wyre-send-funds' && reservationId != null) {
        return { status: 'provisioning', state };
      }
      if (event === 'wyre-send-funds' && reservationId == null) {
        return { status: 'waiting-for-reservation', state };
      }
      throw unhandledEvent(event, orderId, currentStatus);
    case 'waiting-for-reservation':
      if (event === 'received-reservation') {
        return { status: 'provisioning', state };
      }
      throw unhandledEvent(event, orderId, currentStatus);
    case 'provisioning':
      if (event === 'provision-mined') {
        return { status: 'complete', state };
      }
      if (event === 'provision-error') {
        return { status: 'error-provisioning', state };
      }
      throw unhandledEvent(event, orderId, currentStatus);
    case 'complete':
    case 'error-provisioning':
      throw unhandledEvent(event, orderId, currentStatus);
    default:
      assertNever(currentStatus);
  }
}

export async function updateOrderStatus(
  db: DBClient,
  orderId: string,
  event: OrderEvent
): Promise<{ status: OrderStatus; state: OrderState }> {
  let statusInfo = await nextOrderStatus(db, event, orderId);
  let { status } = statusInfo;
  await db.query(`UPDATE wallet_orders SET status = $2, updated_at = now() WHERE order_id = $1`, [orderId, status]);
  return statusInfo;
}

export async function provisionPrepaidCard(
  db: DBClient,
  relay: RelayService,
  subgraph: Subgraph,
  reservationId: string
): Promise<string> {
  let { rows } = await db.query('SELECT * FROM reservations WHERE id = $1', [reservationId]);
  if (rows.length === 0) {
    throw new Error(`Could not find reservation ID ${reservationId}`);
  }
  let [{ sku, user_address: userAddress }] = rows;
  let txnHash;
  try {
    txnHash = await relay.provisionPrepaidCard(toChecksumAddress(userAddress), sku);
  } catch (err) {
    let { rows } = await db.query('SELECT order_id FROM wallet_orders WHERE reservation_id = $1', [reservationId]);
    if (rows.length > 0) {
      let [{ order_id: orderId }] = rows;
      await updateOrderStatus(db, orderId, 'provision-error');
    }
    throw err;
  }
  await db.query('UPDATE reservations SET transaction_hash = $1, updated_at = now() WHERE id = $2', [
    txnHash,
    reservationId,
  ]);
  let prepaidCardAddress = await subgraph.waitForProvisionedPrepaidCard(txnHash);
  await db.query('UPDATE reservations SET prepaid_card_address = $1, updated_at = now() WHERE id = $2', [
    prepaidCardAddress,
    reservationId,
  ]);

  return prepaidCardAddress;
}

function unhandledEvent(event: OrderEvent, orderId: string, currentStatus?: OrderStatus): Error {
  let msg = currentStatus
    ? `Don't know how to handle order event ${event} when an order is in status ${currentStatus} for order id ${orderId}`
    : `Don't know how to handle order event ${event} for a new order id ${orderId}`;

  return new Error(msg);
}

function assertOrderStatus(status: any, orderId: string): asserts status is OrderStatus {
  if (
    !['waiting-for-order', 'received-order', 'waiting-for-reservation', 'provisioning', 'complete'].includes(status)
  ) {
    throw new Error(`Invalid order status for order id '${orderId}':  ${status}`);
  }
}

function assertNever(_value: never): never {
  throw new Error(`not never`);
}
