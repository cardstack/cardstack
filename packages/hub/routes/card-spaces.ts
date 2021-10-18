import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import CardSpaceQueries from '../services/queries/card-space';
import CardSpaceValidator, { CardSpaceErrors } from '../services/validators/card-space';

export interface CardSpace {
  id: string;
  url: string;
  profileName: string;
  profileDescription: string;
  profileCategory: string;
  profileButtonText: string;
  profileImageUrl: string;
  profileCoverImageUrl: string;
  ownerAddress: string;
}

function serializeErrors(errors: any) {
  return Object.keys(errors).flatMap((attribute) => {
    let errorsForAttribute = errors[attribute as keyof CardSpaceErrors];
    return errorsForAttribute.map((errorMessage: string) => {
      return {
        status: '422',
        title: 'Invalid attribute',
        source: { pointer: `/data/attributes/${attribute}` },
        detail: errorMessage,
      };
    });
  });
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
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    const cardSpace: CardSpace = {
      id: shortUuid.uuid(),
      url: this.sanitizeText(ctx.request.body.data.attributes['url']),
      profileName: this.sanitizeText(ctx.request.body.data.attributes['profile-name']),
      profileDescription: this.sanitizeText(ctx.request.body.data.attributes['profile-description']),
      profileCategory: this.sanitizeText(ctx.request.body.data.attributes['profile-category']),
      profileButtonText: this.sanitizeText(ctx.request.body.data.attributes['profile-button-text']),
      profileImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']),
      profileCoverImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-cover-image-url']),
      ownerAddress: ctx.state.userAddress,
    };

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
    ctx.type = 'application/vnd.api+json';
  }

  async getUrlValidation(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let url: string = ctx.params.url;
    let errors = await this.cardSpaceValidator.validate({ url } as CardSpace);

    ctx.status = 200;
    ctx.body = {
      errors: serializeErrors(errors).filter((e) => e.source.pointer === '/data/attributes/url'),
    };
    ctx.type = 'application/vnd.api+json';
  }

  sanitizeText(value: string | unknown): string {
    if (typeof value === 'string') {
      return value.trim().replace(/ +/g, ' ');
    } else {
      return '';
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-spaces-route': CardSpacesRoute;
  }
}
