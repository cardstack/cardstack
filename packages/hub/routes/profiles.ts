import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import { validateRequiredFields } from './utils/validation';
import ProfileValidator from '../services/validators/profile';
import shortUUID from 'short-uuid';
import { Profile } from '@prisma/client';
import { serializeErrors } from './utils/error';

export default class ProfilesRoute {
  profileValidator: ProfileValidator = inject('profile-validator', {
    as: 'profileValidator',
  });
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
        title: 'Invalid profile name',
        detail: 'Profile name cannot exceed 50 characters',
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
        title: 'Invalid profile slug',
        detail: validationResult.detail,
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let prisma = await this.prismaManager.getClient();
    let properties = {
      id: shortUuid.uuid(),
      name: ctx.request.body.data.attributes['name'],
      slug,
      color: ctx.request.body.data.attributes['color'],
      textColor: ctx.request.body.data.attributes['text-color'],
      profileDescription: ctx.request.body.data.attributes['profile-description'],
      profileImageUrl: ctx.request.body.data.attributes['profile-image-url'],
      links: ctx.request.body.data.attributes['links'],
      ownerAddress: ctx.state.userAddress,
    };

    let profile: Profile;

    profile = await prisma.profile.create({ data: { ...properties } });

    await this.workerClient.addJob('persist-off-chain-merchant-info', {
      id: profile.id,
    });

    let serialized = this.profileSerializer.serialize(profile);

    ctx.status = 201;
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

    if (attributes['name']) {
      profile.name = this.sanitizeText(ctx.request.body.data.attributes['name']);
    }

    if (attributes['color']) {
      profile.color = this.sanitizeText(ctx.request.body.data.attributes['color']);
    }

    if (attributes['text-color']) {
      profile.textColor = this.sanitizeText(ctx.request.body.data.attributes['text-color']);
    }

    if (attributes['profile-description']) {
      profile.profileDescription = this.sanitizeText(ctx.request.body.data.attributes['profile-description']);
    }

    if (attributes['profile-image-url']) {
      profile.profileImageUrl = this.sanitizeText(ctx.request.body.data.attributes['profile-image-url']);
    }

    if (attributes['links']) {
      profile.links = ctx.request.body.data.attributes['links'];
    }

    let errors = await this.profileValidator.validate(profile);
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

      await this.workerClient.addJob('persist-off-chain-merchant-info', {
        id: profile.id,
      });

      let serialized = this.profileSerializer.serialize(profile);

      ctx.status = 200;
      ctx.body = serialized;
    }
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

        if (profile) {
          return { slugAvailable: false, detail: 'This ID is already taken. Please choose another one' };
        } else {
          return { slugAvailable: true, detail: 'ID is available' };
        }
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
    'profiles-route': ProfilesRoute;
  }
}
