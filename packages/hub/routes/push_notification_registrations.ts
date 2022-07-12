import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';

import { ensureLoggedIn } from './utils/auth';

import PushNotificationRegistrationSerializer from '../services/serializers/push-notification-registration-serializer';
import shortUuid from 'short-uuid';

export interface PushNotificationRegistration {
  id: string;
  ownerAddress: string;
  pushClientId: string;
  disabledAt: string | null;
}

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
    let ownerAddress = ctx.state.userAddress;
    let pushClientId = ctx.request.body.data.attributes['push-client-id'];

    let pushNotificationRegistration = {
      id: shortUuid.uuid(),
      ownerAddress,
      pushClientId,
      disabledAt: null,
    };

    let prisma = await this.prismaManager.getClient();
    await prisma.push_notification_registrations.upsertTest(shortUuid.uuid(), ownerAddress, pushClientId, null);

    let serialized = await this.pushNotificationRegistrationSerialier.serialize(pushNotificationRegistration);

    ctx.status = 201;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async delete(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let prisma = await this.prismaManager.getClient();

    await prisma.push_notification_registrations.delete({
      where: {
        owner_address_push_client_id: {
          owner_address: ctx.state.userAddress,
          push_client_id: ctx.params.push_client_id,
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
