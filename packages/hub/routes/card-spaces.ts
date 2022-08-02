import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { ensureLoggedIn } from './utils/auth';
import WorkerClient from '../services/worker-client';
import CardSpaceValidator from '../services/validators/card-space';
import { serializeErrors } from './utils/error';

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
    let profile = await prisma.profile.findFirst({ where: { slug } });

    if (!profile) {
      ctx.status = 404;
      return;
    }

    let serialized = await this.cardSpaceSerializer.serialize(profile);

    let serializedMerchant = await this.merchantInfoSerializer.serialize(profile!);
    serialized.included = [serializedMerchant.data];

    ctx.status = 200;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async patch(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }
    let prisma = await this.prismaManager.getClient();

    let profileId = ctx.params.id;
    let profile = await prisma.profile.findUnique({ where: { id: profileId } });

    if (profile) {
      if (ctx.state.userAddress !== profile.ownerAddress) {
        ctx.status = 403;
        return;
      }
    }

    if (!profile) {
      ctx.status = 404;
      return;
    }

    let attributes = ctx.request.body.data.attributes;

    if (attributes['profile-description']) {
      profile.profileDescription = this.sanitizeText(ctx.request.body.data.attributes['profile-description']);
    }

    if (attributes['profile-image-url']) {
      profile.profileImageUrl = this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']);
    }

    if (attributes['links']) {
      profile.links = ctx.request.body.data.attributes['links'];
    }

    let errors = await this.cardSpaceValidator.validate(profile);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;

    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
    } else {
      await prisma.profile.update({
        data: {
          profileDescription: profile.profileDescription,
          profileImageUrl: profile.profileImageUrl,
          links: profile.links,
        },
        where: { id: profile.id },
      });

      let serialized = await this.cardSpaceSerializer.serialize(profile);

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
