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

  async getValidation(ctx: Koa.Context) {
    const charLimit = 50;
    let db = await this.databaseManager.getClient();
    let { slug } = ctx.query;

    if (!slug) {
      logger.error('Merchant slug cannot be undefined');
      return;
    }

    if (typeof slug === 'object') {
      logger.error('Merchant slug cannot be an array');
      return;
    }

    let sanitizedSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$|/g, '');

    if (!sanitizedSlug) {
      logger.error('Merchant slug must include alphanumeric characters');
      return;
    }

    if (sanitizedSlug.length > charLimit) {
      logger.log(`Merchant slug will be cropped at ${charLimit} characters`);
      sanitizedSlug = sanitizedSlug.slice(0, charLimit).replace(/^[^a-z0-9]+|[^a-z0-9]+$|/g, '');
    }

    try {
      let result = await db.query('SELECT slug FROM merchant_infos WHERE slug = $1', [sanitizedSlug]);
      let data =
        result.rowCount === 0 ? { sanitizedSlug, slugAvailable: true } : { sanitizedSlug, slugAvailable: false };
      ctx.status = 200;
      ctx.body = { data };
      ctx.type = 'application/vnd.api+json';
    } catch (e) {
      logger.error('Failed to retrieve merchant_infos', e);
    }
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    if (!ensureValidPayload(ctx)) {
      return;
    }

    const slug = ctx.request.body.data.attributes['slug'];
    const isValidSlug = await this.merchantInfoQueries.validateSlug(slug);

    if (!isValidSlug) {
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Merchant slug already exists',
          },
        ],
      };
      ctx.status = 422;
      ctx.type = 'application/vnd.api+json';
      return;
    }

    const merchantInfo: MerchantInfo = {
      id: shortUuid.uuid(),
      name: ctx.request.body.data.attributes['name'],
      slug,
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
