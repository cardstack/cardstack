import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import shortUuid from 'short-uuid';
import { AuthenticationUtils } from '../utils/authentication';
import MerchantInfoSerializer from '../services/serializers/merchant-info-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import MerchantInfoQueries from '../services/queries/merchant-info';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import Logger from '@cardstack/logger';
let logger = Logger('route:merchant-infos');

export interface MerchantInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  textColor: string;
  ownerAddress: string;
}

export default class MerchantInfosRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  merchantInfoSerializer: MerchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  merchantInfoQueries: MerchantInfoQueries = inject('merchant-info-queries', {
    as: 'merchantInfoQueries',
  });

  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    if (!ensureValidPayload(ctx)) {
      return;
    }

    let isValid = await this.slugValidation(ctx);
    if (!isValid) {
      return;
    }

    const merchantInfo: MerchantInfo = {
      id: shortUuid.uuid(),
      name: ctx.request.body.data.attributes['name'],
      slug: ctx.request.body.data.attributes['slug'],
      color: ctx.request.body.data.attributes['color'],
      textColor: ctx.request.body.data.attributes['text-color'],
      ownerAddress: ctx.state.userAddress,
    };

    await this.merchantInfoQueries.insert(merchantInfo);

    await this.workerClient.addJob('persist-off-chain-merchant-info', {
      id: merchantInfo.id,
    });

    let serialized = await this.merchantInfoSerializer.serialize(merchantInfo);

    ctx.status = 201;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async slugValidation(ctx: Koa.Context) {
    let db = await this.databaseManager.getClient();
    let slug = ctx.request.body?.data?.attributes['slug'] || ctx.query?.slug;

    if (!slug || typeof slug === 'object' || validateMerchantId(slug)) {
      let detail: string;

      if (!slug) {
        detail = `Slug cannot be undefined`;
      } else if (typeof slug === 'object') {
        detail = `Slug cannot be an array`;
      } else {
        detail = validateMerchantId(slug);
      }

      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid merchant slug',
        detail,
      };
      ctx.type = 'application/vnd.api+json';
      return false;
    }

    try {
      let result = await db.query('SELECT slug FROM merchant_infos WHERE slug = $1', [slug]);
      let slugAvailable = result.rowCount === 0;
      ctx.status = 200;
      ctx.body = {
        slugAvailable,
        title: slugAvailable ? 'Merchant slug is available' : 'Merchant slug already exists',
      };
      ctx.type = 'application/vnd.api+json';
      return slugAvailable;
    } catch (e) {
      logger.error('Failed to retrieve merchant_infos', e);
    }
  }
}

function ensureValidPayload(ctx: Koa.Context) {
  let errors = [errorForAttribute(ctx, 'name'), errorForAttribute(ctx, 'slug'), errorForAttribute(ctx, 'color')].filter(
    Boolean
  );

  if (errors.length === 0) {
    return true;
  }
  ctx.body = {
    errors,
  };
  ctx.status = 422;
  ctx.type = 'application/vnd.api+json';
  return false;
}

function errorForAttribute(ctx: Koa.Context, attributeName: string) {
  let attributeValue = ctx.request.body?.data?.attributes?.[attributeName];
  if (attributeValue && attributeValue.length > 0) {
    return;
  }

  return {
    status: '422',
    title: `Missing required attribute: ${attributeName}`,
    detail: `Required field ${attributeName} was not provided`,
  };
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-infos-route': MerchantInfosRoute;
  }
}
