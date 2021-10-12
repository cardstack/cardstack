import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import shortUuid from 'short-uuid';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import CardSpaceQueries from '../services/queries/card-space';
import CardSpaceValidator, { CardSpaceErrors } from '../services/validators/card-space';

export interface CardSpace {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  buttonText: string;
  profileImageUrl: string;
  coverImageUrl: string;
  ownerAddress: string;
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
      name: this.sanitizeText(ctx.request.body.data.attributes['name']),
      url: this.sanitizeText(ctx.request.body.data.attributes['url']),
      description: this.sanitizeText(ctx.request.body.data.attributes['description']),
      category: this.sanitizeText(ctx.request.body.data.attributes['category']),
      buttonText: this.sanitizeText(ctx.request.body.data.attributes['button-text']),
      profileImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']),
      coverImageUrl: this.sanitizeText(ctx.request.body.data.attributes['cover-image-url']),
      ownerAddress: ctx.state.userAddress,
    };

    let errors = await this.cardSpaceValidator.validate(cardSpace);

    if (Object.keys(errors).length > 0) {
      ctx.status = 422;
      ctx.body = {
        errors: Object.keys(errors).flatMap((attribute) => {
          let errorsForAttribute = errors[attribute as keyof CardSpaceErrors];
          return errorsForAttribute.map((errorMessage) => {
            return {
              status: '422',
              title: 'Invalid attribute',
              source: { pointer: `/data/attributes/${attribute}` },
              detail: errorMessage,
            };
          });
        }),
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

  sanitizeText(value: string | unknown): string {
    if (typeof value === 'string') {
      return value.trim().replace(/ +/g, ' ');
    } else {
      return '';
    }
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-spaces-route': CardSpacesRoute;
  }
}
