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

    let slug = ctx.request.body.data.attributes['slug'];
    let isValidSlug = await ensureValidSlug(ctx, slug, this.merchantInfoQueries);

    if (!isValidSlug) {
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

  async getValidation(ctx: Koa.Context) {
    let slug = ctx.query?.slug;
    let isValidSlug = await ensureValidSlug(ctx, slug, this.merchantInfoQueries);

    if (!isValidSlug) {
      return;
    }

    ctx.status = 200;
    ctx.body = {
      slugAvailable: true,
      info: 'Merchant slug is available',
    };
    ctx.type = 'application/vnd.api+json';
  }
}

async function ensureValidSlug(ctx: Koa.Context, slug?: string | string[], queries?: MerchantInfoQueries) {
  let detail = '';

  if (!slug) {
    detail = `Slug cannot be undefined`;
  } else if (typeof slug === 'object') {
    detail = `Slug cannot be an array`;
  } else if (validateMerchantId(slug)) {
    detail = validateMerchantId(slug);
  } else if (queries) {
    let result = await queries.fetch(slug, 'slug');
    detail = result.id ? 'Merchant slug already exists' : '';
  }

  if (detail) {
    ctx.status = 422;
    ctx.body = {
      status: '422',
      title: 'Invalid merchant slug',
      detail,
    };
    ctx.type = 'application/vnd.api+json';
    return false;
  }

  return true;
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
