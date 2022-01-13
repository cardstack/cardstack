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

export interface CardSpace {
  id: string;
  url?: string;
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
  ownerAddress?: string;
  merchantId?: string;
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

  async get(ctx: Koa.Context) {
    let username = ctx.params.username;
    let cardSpace = (await this.cardSpaceQueries.query({ url: `${username}.card.space` }))[0] as CardSpace;

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

  async put(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let cardSpaceId = ctx.params.id;
    let cardSpace = (await this.cardSpaceQueries.query({ id: cardSpaceId }))[0] as CardSpace;

    if (cardSpace) {
      if (ctx.state.userAddress !== cardSpace.ownerAddress) {
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

  async postUrlValidation(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let url: string = ctx.request.body.data.attributes.url;
    let errors = await this.cardSpaceValidator.validate({ url } as CardSpace);

    ctx.status = 200;
    ctx.body = {
      errors: serializeErrors(errors).filter((e) => e.source.pointer === '/data/attributes/url'),
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
