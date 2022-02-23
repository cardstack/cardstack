import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import { validateRequiredFields } from './utils/validation';
import { MerchantInfoQueriesFilter } from '../services/queries/merchant-info';
import { CardSpace } from './card-spaces';

export interface MerchantInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  textColor: string;
  ownerAddress: string;
}

export default class MerchantInfosRoute {
  authenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  merchantInfoQueries = inject('merchant-info-queries', {
    as: 'merchantInfoQueries',
  });
  cardSpaceQueries = inject('card-space-queries', {
    as: 'cardSpaceQueries',
  });
  reservedWords = inject('reserved-words', {
    as: 'reservedWords',
  });

  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let params: MerchantInfoQueriesFilter = {
      ownerAddress: ctx.state.userAddress,
      customFilter: undefined,
    };

    if (ctx.query.availableForCardSpace) {
      params.customFilter = {
        availableForCardSpace: true,
      };
    }

    let merchantInfos = await this.merchantInfoQueries.fetch(params);

    ctx.type = 'application/vnd.api+json';
    ctx.status = 200;
    ctx.body = this.merchantInfoSerializer.serializeCollection(merchantInfos);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    if (!validateRequiredFields(ctx, { requiredAttributes: ['name', 'slug', 'color'] })) {
      return;
    }

    if (ctx.request.body.data.attributes['name'].length > 50) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid merchant name',
        detail: 'Merchant name cannot exceed 50 characters',
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let slug = ctx.request.body.data.attributes['slug'].toLowerCase();
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

    let db = await this.databaseManager.getClient();
    let merchantInfoId, cardSpaceId;

    await this.databaseManager.performTransaction(db, async () => {
      merchantInfoId = (await this.merchantInfoQueries.insert(merchantInfo, db)).id;
      cardSpaceId = (
        await this.cardSpaceQueries.insert({ id: shortUuid.uuid(), merchantId: merchantInfoId } as CardSpace, db)
      ).id;
    });

    await this.workerClient.addJob('persist-off-chain-merchant-info', {
      id: merchantInfoId,
    });

    await this.workerClient.addJob('persist-off-chain-card-space', {
      id: cardSpaceId,
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
      if (
        this.reservedWords.isReserved(slug, (reservedWord) => reservedWord.replace(/[^0-9a-zA-Z]/g, '').toLowerCase())
      ) {
        return {
          slugAvailable: false,
          detail: 'This Merchant ID is not allowed',
        };
      } else {
        let merchantInfo = (await this.merchantInfoQueries.fetch({ slug }))[0];
        return {
          slugAvailable: merchantInfo ? false : true,
          detail: merchantInfo
            ? 'This Merchant ID is already taken. Please choose another one'
            : 'Merchant slug is available',
        };
      }
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-infos-route': MerchantInfosRoute;
  }
}
