import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import CardSpaceQueries from '../services/queries/card-space';
import CardSpaceValidator from '../services/validators/card-space';
import { serializeErrors } from './utils/error';
import { validateRequiredFields } from './utils/validation';
import MerchantInfoQueries from '../services/queries/merchant-info';

export interface CardSpace {
  id: string;
  profileName?: string;
  profileDescription?: string;
  profileCategory?: string;
  profileButtonText?: string;
  profileImageUrl?: string;
  profileCoverImageUrl?: string;
  bioTitle?: string;
  bioDescription?: string;
  links?: any[];
  donationTitle?: string;
  donationDescription?: string;
  donationSuggestionAmount1?: number;
  donationSuggestionAmount2?: number;
  donationSuggestionAmount3?: number;
  donationSuggestionAmount4?: number;
  merchantId?: string;
  merchantName?: string;
  merchantOwnerAddress?: string;
}

export default class CardSpacesRoute {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  cardSpaceSerializer: CardSpaceSerializer = inject('card-space-serializer', {
    as: 'cardSpaceSerializer',
  });
  cardSpaceQueries: CardSpaceQueries = inject('card-space-queries', {
    as: 'cardSpaceQueries',
  });
  cardSpaceValidator: CardSpaceValidator = inject('card-space-validator', {
    as: 'cardSpaceValidator',
  });
  merchantInfoQueries: MerchantInfoQueries = inject('merchant-info-queries', {
    as: 'merchantInfoQueries',
  });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let slug = ctx.params.slug;
    let cardSpace = (await this.cardSpaceQueries.query({ merchantSlug: slug }))[0] as CardSpace;

    if (!cardSpace) {
      ctx.status = 404;
      return;
    }

    let serialized = await this.cardSpaceSerializer.serialize(cardSpace);

    ctx.status = 200;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    if (!validateRequiredFields(ctx, { requiredRelationships: ['merchant-info'] })) {
      return;
    }

    const cardSpace: CardSpace = {
      id: shortUuid.uuid(),
      merchantId: this.sanitizeText(ctx.request.body.data.relationships['merchant-info'].data.id),
      profileName: this.sanitizeText(ctx.request.body.data.attributes['profile-name']),
      profileDescription: this.sanitizeText(ctx.request.body.data.attributes['profile-description']),
      profileCategory: this.sanitizeText(ctx.request.body.data.attributes['profile-category']),
      profileButtonText: this.sanitizeText(ctx.request.body.data.attributes['profile-button-text']),
      profileImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']),
      profileCoverImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-cover-image-url']),
    };

    let merchantInfoError;

    let merchantId = cardSpace.merchantId;
    let merchant = (await this.merchantInfoQueries.fetch({ id: merchantId }))[0];

    if (merchant) {
      if (merchant.ownerAddress !== ctx.state.userAddress) {
        merchantInfoError = [
          {
            detail: `Given merchant-id ${merchantId} is not owned by the user`,
            relationship: 'merchant-info',
            status: 403,
          },
        ];
      }
    } else {
      merchantInfoError = [
        {
          detail: `Given merchant-id ${merchantId} was not found`,
          relationship: 'merchant-info',
        },
      ];
    }

    if (merchantInfoError) {
      ctx.status = merchantInfoError[0].status || 422;
      ctx.body = {
        errors: serializeErrors({ merchantInfo: merchantInfoError }),
      };
    } else {
      let errors = await this.cardSpaceValidator.validate(cardSpace);
      let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;

      if (hasErrors) {
        ctx.status = 422;
        ctx.body = {
          errors: serializeErrors(errors),
        };
      } else {
        await this.cardSpaceQueries.insert(cardSpace);

        await this.workerClient.addJob('persist-off-chain-card-space', {
          id: cardSpace.id,
        });

        let serialized = await this.cardSpaceSerializer.serialize(cardSpace);
        ctx.status = 201;
        ctx.body = serialized;
      }
    }
    ctx.type = 'application/vnd.api+json';
  }

  async put(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let cardSpaceId = ctx.params.id;
    let cardSpace = (await this.cardSpaceQueries.query({ id: cardSpaceId }))[0] as CardSpace;

    if (cardSpace) {
      if (ctx.state.userAddress !== cardSpace.merchantOwnerAddress) {
        ctx.status = 403;
        return;
      }
    }

    if (!cardSpace) {
      ctx.status = 404;
      return;
    }

    cardSpace.profileName = this.sanitizeText(ctx.request.body.data.attributes['profile-name']);
    cardSpace.profileDescription = this.sanitizeText(ctx.request.body.data.attributes['profile-description']);
    cardSpace.profileCategory = this.sanitizeText(ctx.request.body.data.attributes['profile-category']);
    cardSpace.profileImageUrl = this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']);
    cardSpace.profileCoverImageUrl = this.sanitizeText(ctx.request.body.data.attributes['profile-cover-image-url']);
    cardSpace.profileButtonText = this.sanitizeText(ctx.request.body.data.attributes['profile-button-text']);
    cardSpace.bioTitle = this.sanitizeText(ctx.request.body.data.attributes['bio-title']);
    cardSpace.bioDescription = this.sanitizeText(ctx.request.body.data.attributes['bio-description']);
    cardSpace.links = ctx.request.body.data.attributes['links'];
    cardSpace.donationTitle = this.sanitizeText(ctx.request.body.data.attributes['donation-title']);
    cardSpace.donationDescription = this.sanitizeText(ctx.request.body.data.attributes['donation-description']);
    cardSpace.donationSuggestionAmount1 = ctx.request.body.data.attributes['donation-suggestion-amount-1'];
    cardSpace.donationSuggestionAmount2 = ctx.request.body.data.attributes['donation-suggestion-amount-2'];
    cardSpace.donationSuggestionAmount3 = ctx.request.body.data.attributes['donation-suggestion-amount-3'];
    cardSpace.donationSuggestionAmount4 = ctx.request.body.data.attributes['donation-suggestion-amount-4'];

    let errors = await this.cardSpaceValidator.validate(cardSpace);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;

    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
    } else {
      await this.cardSpaceQueries.update(cardSpace);

      await this.workerClient.addJob('persist-off-chain-card-space', {
        id: cardSpace.id,
      });

      let serialized = await this.cardSpaceSerializer.serialize(cardSpace);

      ctx.status = 200;
      ctx.body = serialized;
    }
    ctx.type = 'application/vnd.api+json';
  }

  async postProfileCategoryValidation(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let profileCategory: string = ctx.request.body.data.attributes['profile-category'];
    let errors = await this.cardSpaceValidator.validate({ profileCategory } as CardSpace);

    ctx.status = 200;
    ctx.body = {
      errors: serializeErrors(errors).filter((e) => e.source.pointer === '/data/attributes/profile-category'),
    };
    ctx.type = 'application/vnd.api+json';
  }

  async postProfileNameValidation(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let profileName: string = ctx.request.body.data.attributes['profile-name'];
    let errors = await this.cardSpaceValidator.validate({ profileName } as CardSpace);

    ctx.status = 200;
    ctx.body = {
      errors: serializeErrors(errors).filter((e) => e.source.pointer === '/data/attributes/profile-name'),
    };
    ctx.type = 'application/vnd.api+json';
  }

  sanitizeText(value: string | unknown): any {
    if (typeof value === 'string') {
      return value.trim().replace(/ +/g, ' ');
    } else {
      return value;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-spaces-route': CardSpacesRoute;
  }
}
