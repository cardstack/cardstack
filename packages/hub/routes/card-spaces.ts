import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import CardSpaceValidator from '../services/validators/card-space';
import { serializeErrors } from './utils/error';
import { validateRequiredFields } from './utils/validation';
import { query } from '../queries';

export interface CardSpace {
  id: string;
  profileDescription?: string;
  profileImageUrl?: string;
  links?: any[];
  merchantId?: string;
  merchantName?: string;
  merchantOwnerAddress?: string;
}

export default class CardSpacesRoute {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  cardSpaceSerializer: CardSpaceSerializer = inject('card-space-serializer', {
    as: 'cardSpaceSerializer',
  });
  cardSpaceQueries = query('card-space', { as: 'cardSpaceQueries' });
  cardSpaceValidator: CardSpaceValidator = inject('card-space-validator', {
    as: 'cardSpaceValidator',
  });
  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  merchantInfoQueries = query('merchant-info', {
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

    let merchant = (await this.merchantInfoQueries.fetch({ id: cardSpace.merchantId }))[0];

    let serialized = await this.cardSpaceSerializer.serialize(cardSpace);

    let serializedMerchant = await this.merchantInfoSerializer.serialize(merchant);
    serialized.included = [serializedMerchant.data];

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
      profileDescription: this.sanitizeText(ctx.request.body.data.attributes['profile-description']),
      profileImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']),
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

    cardSpace.profileDescription = this.sanitizeText(ctx.request.body.data.attributes['profile-description']);
    cardSpace.profileImageUrl = this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']);
    cardSpace.links = ctx.request.body.data.attributes['links'];

    let errors = await this.cardSpaceValidator.validate(cardSpace);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;

    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
    } else {
      await this.cardSpaceQueries.update(cardSpace);

      let serialized = await this.cardSpaceSerializer.serialize(cardSpace);

      ctx.status = 200;
      ctx.body = serialized;
    }
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
