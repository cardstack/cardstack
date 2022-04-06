import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import { validateRequiredFields } from './utils/validation';
import { handleError } from './utils/error';
import { validate as validateUUID } from 'uuid';
import * as Sentry from '@sentry/node';
import { captureSentryMessage } from './utils/sentry';
import { getSDK } from '@cardstack/cardpay-sdk';
import Logger from '@cardstack/logger';
import { service } from '@cardstack/hub/services';

let log = Logger('routes:reservations');

export default class ReservationsRoute {
  web3 = inject('web3-http', { as: 'web3' });
  relay = service('relay');
  inventory = inject('inventory');
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  constructor() {
    autoBind(this);
  }
  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let userAddress = ctx.state.userAddress.toLowerCase();
    let reservationId: string = ctx.params.reservation_id;
    if (!validateUUID(reservationId)) {
      handleNotFound(ctx);
      return;
    }

    let db = await this.databaseManager.getClient();
    let { rows } = await db.query(`SELECT * FROM reservations WHERE id = $1 AND user_address = $2`, [
      reservationId,
      userAddress,
    ]);
    if (rows.length === 0) {
      handleNotFound(ctx);
      return;
    }
    let [{ sku, transaction_hash: txnHash, prepaid_card_address: prepaidCardAddress }] = rows;

    ctx.status = 200;
    ctx.body = {
      data: {
        id: reservationId,
        type: 'reservations',
        attributes: {
          'user-address': userAddress,
          sku,
          'transaction-hash': txnHash,
          'prepaid-card-address': prepaidCardAddress,
        },
      },
    };
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    if (!validateRequiredFields(ctx, { requiredAttributes: ['sku'] })) {
      return;
    }

    let userAddress = ctx.state.userAddress.toLowerCase();
    let sku = ctx.request.body.data.attributes.sku;
    Sentry.addBreadcrumb({ message: `received reservation create: userAddress=${userAddress}, sku=${sku}` });

    let [relayIsAvailable, rpcIsAvailable] = await Promise.all([this.relay.isAvailable(), this.web3.isAvailable()]);
    if (!relayIsAvailable) {
      handleError(ctx, 503, 'Relay Server Unavailable', `The relay server is unavailable`);
      let msg = `Relay server is not available, cannot create reservation: userAddress=${userAddress}, sku=${sku}`;
      log.error(msg);
      captureSentryMessage(msg, ctx);
      return;
    }
    if (!rpcIsAvailable) {
      handleError(ctx, 503, 'RPC Node Unavailable', `The RPC node is unavailable`);
      let msg = `RPC node is not available, cannot create reservation: userAddress=${userAddress}, sku=${sku}`;
      log.error(msg);
      captureSentryMessage(msg, ctx);
      return;
    }

    let prepaidCardMarket = await getSDK('PrepaidCardMarket', this.web3.getInstance());
    if (await prepaidCardMarket.isPaused()) {
      handleError(ctx, 503, 'Contract paused', `The market contract is paused`);
      captureSentryMessage(
        `Cannot create reservation for ${userAddress} with sku ${sku}, the market contract is paused`,
        ctx
      );
      return;
    }

    let skuSummaries = await this.inventory.getSKUSummaries();
    let skuSummary = skuSummaries.find((summary) => summary.id === sku);
    if (skuSummary?.attributes?.quantity === 0) {
      handleError(ctx, 400, 'No inventory available', `There are no more prepaid cards available for the SKU ${sku}`);
      captureSentryMessage(`Cannot create reservation for ${userAddress}. No inventory available for SKU ${sku}`, ctx);
      return;
    }
    if (!skuSummary) {
      handleError(ctx, 400, 'SKU does not exist', `The SKU ${sku} does not exist`);
      captureSentryMessage(`Cannot create reservation for ${userAddress}. SKU ${sku} does not exist`, ctx);
      return;
    }

    let db = await this.databaseManager.getClient();
    // before creating a new reservation for the user, delete all the abandoned
    // reservations (reservations without orders associated with them). A user
    // is only allowed one active non-order associated reservation at a time.
    await db.query(
      `DELETE FROM reservations WHERE id IN (
        SELECT id FROM (
          SELECT r.id, r.user_address, w.reservation_id AS reservation_with_order
          FROM reservations AS r
          LEFT JOIN wallet_orders AS w ON r.id = w.reservation_id
        ) AS j
        WHERE reservation_with_order IS NULL AND user_address = $1
      )`,
      [userAddress]
    );
    let {
      rows: [{ id }],
    } = await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2) RETURNING id`, [userAddress, sku]);
    ctx.status = 201;
    ctx.body = {
      data: {
        id,
        type: 'reservations',
        attributes: {
          'user-address': userAddress,
          sku,
          'transaction-hash': null,
          'prepaid-card-address': null,
        },
      },
    };
    ctx.type = 'application/vnd.api+json';
  }
}

function handleNotFound(ctx: Koa.Context) {
  handleError(ctx, 404, 'Reservation not found', `Could not find the reservation ${ctx.params.reservation_id}`);
}

declare module '@cardstack/di' {
  interface KnownServices {
    'reservations-route': ReservationsRoute;
  }
}
