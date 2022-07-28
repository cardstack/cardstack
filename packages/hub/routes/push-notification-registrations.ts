import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';

import { ensureLoggedIn } from './utils/auth';

import PushNotificationRegistrationSerializer from '../services/serializers/push-notification-registration-serializer';
import shortUuid from 'short-uuid';

export default class PushNotificationRegistrationsRoute {
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  pushNotificationRegistrationSerialier: PushNotificationRegistrationSerializer = inject(
    'push-notification-registration-serializer',
    {
      as: 'pushNotificationRegistrationSerialier',
    }
  );

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let pushNotificationRegistration = {
      id: shortUuid.uuid(),
      ownerAddress: ctx.state.userAddress,
      pushClientId: ctx.request.body.data.attributes['push-client-id'],
      disabledAt: null,
    };

    let prisma = await this.prismaManager.getClient();
    let record = await prisma.pushNotificationRegistration.upsertByOwnerAndPushClient(pushNotificationRegistration);

    let serialized = this.pushNotificationRegistrationSerialier.serialize(record);

    ctx.status = 201;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async delete(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let prisma = await this.prismaManager.getClient();

    await prisma.pushNotificationRegistration.delete({
      where: {
        ownerAddress_pushClientId: {
          ownerAddress: ctx.state.userAddress,
          pushClientId: ctx.params.push_client_id,
        },
      },
    });

    ctx.status = 200;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'push-notification-registrations-route': PushNotificationRegistrationsRoute;
  }
}
