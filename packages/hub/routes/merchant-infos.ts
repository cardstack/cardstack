import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import { validateRequiredFields } from './utils/validation';
import shortUUID from 'short-uuid';

export default class MerchantInfosRoute {
  profileSerializer = inject('profile-serializer', {
    as: 'profileSerializer',
  });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
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
    let prisma = await this.prismaManager.getClient();
    let profiles = await prisma.profile.findMany({
      where: {
        ownerAddress: ctx.state.userAddress,
      },
    });

    ctx.type = 'application/vnd.api+json';
    ctx.status = 200;
    ctx.body = this.profileSerializer.serialize(profiles);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    if (!validateRequiredFields(ctx, { requiredAttributes: ['name', 'slug', 'color', 'text-color'] })) {
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

    let prisma = await this.prismaManager.getClient();
    const properties = {
      id: shortUuid.uuid(),
      name: ctx.request.body.data.attributes['name'],
      slug,
      color: ctx.request.body.data.attributes['color'],
      textColor: ctx.request.body.data.attributes['text-color'],
      ownerAddress: ctx.state.userAddress,
    };

    let merchantInfo = await prisma.profile.create({ data: { ...properties } });

    await this.workerClient.addJob('persist-off-chain-profile', {
      id: merchantInfo.id,
    });

    let serialized = this.profileSerializer.serialize(merchantInfo);

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
          detail: 'This ID is not allowed',
        };
      } else {
        let prisma = await this.prismaManager.getClient();
        let profile = await prisma.profile.findFirst({ where: { slug } });
        return {
          slugAvailable: profile ? false : true,
          detail: profile ? 'This ID is already taken. Please choose another one' : 'ID is available',
        };
      }
    }
  }

  async getFromShortId(ctx: Koa.Context) {
    let prisma = await this.prismaManager.getClient();
    let profile = await prisma.profile.findUnique({
      where: {
        id: shortUUID().toUUID(ctx.params.id),
      },
    });

    if (!profile) {
      ctx.status = 404;
      return;
    }

    ctx.status = 200;
    ctx.body = this.profileSerializer.serialize(profile);
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-infos-route': MerchantInfosRoute;
  }
}
