import Koa from 'koa';
import autoBind from 'auto-bind';
import Logger from '@cardstack/logger';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import { validateRequiredFields } from './utils/validation';
import { validate as validateUUID } from 'uuid';
import * as JSONAPI from 'jsonapi-typescript';
import * as Sentry from '@sentry/node';
import { captureSentryMessage } from './utils/sentry';
import { handleError } from './utils/error';
let log = Logger('route:orders');

export default class OrdersRoute {
  order = inject('order');
  authenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  wyre = inject('wyre');

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    if (
      !validateRequiredFields(ctx, {
        requiredAttributes: ['order-id', 'wallet-id'],
        requiredRelationships: ['reservation'],
      })
    ) {
      return;
    }
    let userAddress = ctx.state.userAddress.toLowerCase();
    let orderId = ctx.request.body.data.attributes['order-id'];
    let walletId = ctx.request.body.data.attributes['wallet-id'];
    let reservationId = ctx.request.body.data.relationships.reservation.data.id;
    Sentry.addBreadcrumb({
      message: `received order create: userAddress=${userAddress}, orderId=${orderId}, walletId=${walletId}, reservationId=${reservationId}`,
    });

    let validationError = await this.validateOrder(orderId, userAddress, reservationId, walletId);
    if (validationError) {
      handleError(ctx, 422, 'Cannot create order', validationError);
      captureSentryMessage(
        `could not validate order creation for orderId=${orderId}. validationError=${validationError}`,
        ctx
      );
      return;
    }

    let db = await this.databaseManager.getClient();
    let status: string;
    ({ status } = await this.order.nextOrderStatus('received-reservation', orderId));
    await db.query(
      `INSERT INTO wallet_orders (
           order_id, user_address, wallet_id, reservation_id, status
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id)
         DO UPDATE SET
           reservation_id = $4,
           status = $5,
           updated_at = now()`,
      [orderId, userAddress.toLowerCase(), walletId, reservationId, status]
    );

    if (status === 'provisioning') {
      Sentry.addBreadcrumb({ message: `provisioning prepaid card for reservationId=${reservationId}` });
      try {
        await this.order.provisionPrepaidCard(reservationId);
      } catch (err: any) {
        let message = `Could not provision prepaid card for reservationId ${reservationId}! Received error from relay server: ${err.toString()}`;
        log.error(message, err);
        captureSentryMessage(message, ctx);
        throw err;
      }
      ({ status } = await this.order.updateOrderStatus(orderId, 'provision-mined'));
    }

    ctx.status = 201;
    ctx.body = await this.makeOrderDocument(orderId, userAddress, reservationId, walletId, status);
    ctx.type = 'application/vnd.api+json';
    return;
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let userAddress = ctx.state.userAddress.toLowerCase();
    let orderId = ctx.params.order_id;
    let db = await this.databaseManager.getClient();
    let { rows } = await db.query(`SELECT * FROM wallet_orders WHERE order_id = $1`, [orderId]);
    if (rows.length === 0) {
      handleNotFound(ctx);
      return;
    }

    let [{ wallet_id: walletId, user_address: orderUserAddress, reservation_id: reservationId, status }] = rows;
    if (userAddress !== orderUserAddress) {
      handleNotFound(ctx);
      return;
    }

    ctx.status = 200;
    ctx.body = await this.makeOrderDocument(orderId, userAddress, reservationId, walletId, status);
    ctx.type = 'application/vnd.api+json';
    return;
  }

  private async validateOrder(
    orderId: string,
    userAddress: string,
    reservationId: string,
    walletId: string
  ): Promise<string | undefined> {
    // make sure that we word our error messages such that we don't leak the
    // existence of entities that the user is not entitled to access
    let db = await this.databaseManager.getClient();

    if (!validateUUID(reservationId)) {
      return `Could not locate reservation ${reservationId}`;
    }
    let { rows: reservations } = await db.query('SELECT * from reservations WHERE id = $1', [reservationId]);
    if (reservations.length === 0) {
      return `Could not locate reservation ${reservationId}`;
    }
    let [{ user_address: reservationUserAddress }] = reservations;
    if (reservationUserAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return `Could not locate reservation ${reservationId}`;
    }
    let { rows: orders } = await db.query('SELECT * from wallet_orders WHERE order_id = $1', [orderId]);
    if (orders.length > 0) {
      let [{ user_address: orderUserAddress, wallet_id: orderWalletId }] = orders;
      if (orderUserAddress.toLowerCase() !== userAddress.toLowerCase()) {
        return `Could not locate order ${orderId}`;
      }
      if (walletId !== orderWalletId) {
        return `Could not locate order ${orderId}`;
      }
    }
    let wallet = await this.wyre.getWalletByUserAddress(userAddress);
    if (!wallet) {
      return `Could not locate wallet ${walletId}`;
    }
    if (wallet.id !== walletId) {
      return `Could not locate wallet ${walletId}`;
    }

    return;
  }

  private async makeOrderDocument(
    orderId: string,
    userAddress: string,
    reservationId: string | null,
    walletId: string,
    status: string
  ): Promise<JSONAPI.Document> {
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
      included: [await this.makeReservationResource(reservationId)],
    };
  }

  private async makeReservationResource(reservationId: string): Promise<JSONAPI.ResourceObject> {
    let db = await this.databaseManager.getClient();
    let {
      rows: [{ user_address: userAddress, sku, transaction_hash: txnHash, prepaid_card_address: prepaidCardAddress }],
    } = await db.query(
      `SELECT
         id,
         user_address,
         sku,
         transaction_hash,
         prepaid_card_address
       FROM reservations
       WHERE id = $1`,
      [reservationId]
    );
    return {
      id: reservationId,
      type: 'reservations',
      attributes: {
        'user-address': userAddress,
        sku,
        'transaction-hash': txnHash,
        'prepaid-card-address': prepaidCardAddress,
      },
    };
  }
}

function handleNotFound(ctx: Koa.Context) {
  handleError(ctx, 404, 'Order not found', `Order ${ctx.params.order_id} not found`);
}

declare module '@cardstack/di' {
  interface KnownServices {
    'route:orders': OrdersRoute;
  }
}
