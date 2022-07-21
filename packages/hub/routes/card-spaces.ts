import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import CardSpaceValidator from '../services/validators/card-space';
import { serializeErrors } from './utils/error';
import { validateRequiredFields } from './utils/validation';

export default class CardSpacesRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  cardSpaceSerializer: CardSpaceSerializer = inject('card-space-serializer', {
    as: 'cardSpaceSerializer',
  });
  cardSpaceValidator: CardSpaceValidator = inject('card-space-validator', {
    as: 'cardSpaceValidator',
  });
  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let slug = ctx.params.slug;
    let prisma = await this.prismaManager.getClient();
    let cardSpace = await prisma.cardSpace.findFirst({ where: { merchantInfo: { slug } } });

    if (!cardSpace) {
      ctx.status = 404;
      return;
    }

    let merchantInfo = await prisma.merchantInfo.findUnique({ where: { id: cardSpace.merchantId } });

    let serialized = await this.cardSpaceSerializer.serialize(cardSpace);

    let serializedMerchant = await this.merchantInfoSerializer.serialize(merchantInfo!);
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

    const cardSpace = {
      id: shortUuid.uuid(),
      merchantId: this.sanitizeText(ctx.request.body.data.relationships['merchant-info'].data.id),
      profileDescription: this.sanitizeText(ctx.request.body.data.attributes['profile-description']),
      profileImageUrl: this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']),
    };

    let prisma = await this.prismaManager.getClient();

    let merchantInfoError;

    let merchantId = cardSpace.merchantId;
    let merchant = await prisma.merchantInfo.findUnique({ where: { id: merchantId } });

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
        await prisma.cardSpace.create({ data: cardSpace });

        let serialized = await this.cardSpaceSerializer.serialize(cardSpace);
        ctx.status = 201;
        ctx.body = serialized;
      }
    }
    ctx.type = 'application/vnd.api+json';
  }

  async patch(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let prisma = await this.prismaManager.getClient();

    let cardSpaceId = ctx.params.id;
    let cardSpace = await prisma.cardSpace.findUnique({ where: { id: cardSpaceId }, include: { merchantInfo: true } });

    if (cardSpace) {
      if (ctx.state.userAddress !== cardSpace.merchantInfo.ownerAddress) {
        ctx.status = 403;
        return;
      }
    }

    if (!cardSpace) {
      ctx.status = 404;
      return;
    }

    let attributes = ctx.request.body.data.attributes;

    if (attributes['profile-description']) {
      cardSpace.profileDescription = this.sanitizeText(ctx.request.body.data.attributes['profile-description']);
    }

    if (attributes['profile-image-url']) {
      cardSpace.profileImageUrl = this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']);
    }

    if (attributes['links']) {
      cardSpace.links = ctx.request.body.data.attributes['links'];
    }

    let errors = await this.cardSpaceValidator.validate(cardSpace);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;

    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
    } else {
      await prisma.cardSpace.update({
        data: {
          profileDescription: cardSpace.profileDescription,
          profileImageUrl: cardSpace.profileImageUrl,
          merchantId: cardSpace.merchantId,
          links: cardSpace.links,
        },
        where: { id: cardSpace.id },
      });

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
