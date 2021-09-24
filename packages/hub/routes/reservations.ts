import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '../di/dependency-injection';
import { AuthenticationUtils } from '../utils/authentication';
import { validateRequiredFields } from './utils/validation';
import { getSKUSummaries } from './utils/inventory';
import { validate as validateUUID } from 'uuid';

export default class ReservationsRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  subgraph = inject('subgraph');
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
    let skuSummaries = await getSKUSummaries(await this.databaseManager.getClient(), this.subgraph);
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
      return;
    }

    let db = await this.databaseManager.getClient();
    let result = await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2) RETURNING id`, [
      userAddress,
      sku,
    ]);
    let {
      rows: [{ id }],
    } = result;
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
