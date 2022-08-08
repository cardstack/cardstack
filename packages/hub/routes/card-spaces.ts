import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import ProfileSerializer from '../services/serializers/profile-serializer';
import WorkerClient from '../services/worker-client';
import CardSpaceValidator from '../services/validators/card-space';

export default class CardSpacesRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  profileSerializer: ProfileSerializer = inject('profile-serializer', {
    as: 'profileSerializer',
  });
  cardSpaceValidator: CardSpaceValidator = inject('card-space-validator', {
    as: 'cardSpaceValidator',
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

    let serialized = await this.profileSerializer.serialize(profile, 'card-spaces');

    ctx.status = 200;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-spaces-route': CardSpacesRoute;
  }
}
