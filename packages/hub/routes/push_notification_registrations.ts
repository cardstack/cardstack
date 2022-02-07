import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';

import { ensureLoggedIn } from './utils/auth';

import PushNotificationRegistrationSerializer from '../services/serializers/push-notification-registration-serializer';
import PushNotificationRegistrationQueries from '../services/queries/push-notification-registration';
import shortUuid from 'short-uuid';

export interface PushNotificationRegistration {
  id: string;
  ownerAddress: string;
  pushClientId: string;
  disabledAt: string | null;
}

export default class PushNotificationRegistrationsRoute {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  pushNotificationRegistrationSerialier: PushNotificationRegistrationSerializer = inject(
    'push-notification-registration-serializer',
    {
      as: 'pushNotificationRegistrationSerialier',
    }
  );
  pushNotificationRegistrationQueries: PushNotificationRegistrationQueries = inject(
    'push-notification-registration-queries',
    {
      as: 'pushNotificationRegistrationQueries',
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

    await this.pushNotificationRegistrationQueries.upsert(pushNotificationRegistration);

    let serialized = await this.pushNotificationRegistrationSerialier.serialize(pushNotificationRegistration);

    ctx.status = 201;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async delete(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    await this.pushNotificationRegistrationQueries.delete({
      ownerAddress: ctx.state.userAddress,
      pushClientId: ctx.params.push_client_id,
    } as PushNotificationRegistration);

    ctx.status = 200;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'push-notification-registrations-route': PushNotificationRegistrationsRoute;
  }
}
