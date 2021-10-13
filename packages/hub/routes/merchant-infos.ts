import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { AuthenticationUtils } from '../utils/authentication';
import MerchantInfoSerializer from '../services/serializers/merchant-info-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import MerchantInfoQueries from '../services/queries/merchant-info';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import { validateRequiredFields } from './utils/validation';

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

    if (!validateRequiredFields(ctx, { requiredAttributes: ['name', 'slug', 'color'] })) {
      return;
    }

    let slug = ctx.request.body.data.attributes['slug'];
    let validationResult = await this.validateSlug(slug);

    if (!validationResult.slugAvailable) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid merchant slug',
        detail: validationResult.detail,
      };
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

  async getValidation(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let slug: string = ctx.params.slug;
    let validationResult = await this.validateSlug(slug);

    ctx.status = 200;
    ctx.body = validationResult;
    ctx.type = 'application/vnd.api+json';
  }

  async validateSlug(slug: string) {
    let errorMessage = validateMerchantId(slug);

    if (errorMessage) {
      return {
        slugAvailable: false,
        detail: errorMessage,
      };
    } else {
      let merchantInfo = (await this.merchantInfoQueries.fetch({ slug }))[0];
      return {
        slugAvailable: merchantInfo ? false : true,
        detail: merchantInfo ? 'Merchant slug already exists' : 'Merchant slug is available',
      };
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-infos-route': MerchantInfosRoute;
  }
}
