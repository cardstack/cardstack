import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '../di/dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';
import { validateRequiredFields } from './utils/validation';
import { getSKUSummaries } from './utils/inventory';
import { validate as validateUUID } from 'uuid';
import * as Sentry from '@sentry/node';
import { captureSentryMessage } from './utils/sentry';
import { getSDK } from '@cardstack/cardpay-sdk';

export default class ReservationsRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  subgraph = inject('subgraph');
  web3 = inject('web3');
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

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

    let prepaidCardMarket = await getSDK('PrepaidCardMarket', this.web3.getInstance());
    if (await prepaidCardMarket.isPaused()) {
      ctx.status = 400;
      ctx.body = {
        errors: [
          {
            status: '400',
            title: 'Contract paused',
            detail: `The market contract is paused`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      captureSentryMessage(
        `Cannot create reservation for ${userAddress} with sku ${sku}, the market contract is paused`,
        ctx
      );
      return;
    }

    let skuSummaries = await getSKUSummaries(await this.databaseManager.getClient(), this.subgraph, this.web3);
    let skuSummary = skuSummaries.find((summary) => summary.id === sku);
    if (skuSummary?.attributes?.quantity === 0) {
      ctx.status = 400;
      ctx.body = {
        errors: [
          {
            status: '400',
            title: 'No inventory available',
            detail: `There are no more prepaid cards available for the SKU ${sku}`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      captureSentryMessage(`Cannot create reservation for ${userAddress}. No inventory available for SKU ${sku}`, ctx);
      return;
    }
    if (!skuSummary) {
      ctx.status = 400;
      ctx.body = {
        errors: [
          {
            status: '400',
            title: 'SKU does not exist',
            detail: `The SKU ${sku} does not exist`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
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
  ctx.status = 404;
  ctx.body = {
    errors: [
      {
        status: '404',
        title: 'Reservation not found',
        detail: `Could not find the reservation ${ctx.params.reservation_id}`,
      },
    ],
  };
  ctx.type = 'application/vnd.api+json';
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'reservations-route': ReservationsRoute;
  }
}
