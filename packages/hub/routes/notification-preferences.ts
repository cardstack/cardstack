import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import { ensureLoggedIn } from './utils/auth';
import NotificationTypeQueries from '../services/queries/notification-type';
import NotificationPreferenceQueries from '../services/queries/notification-preference';
import NotificationPreferenceSerializer from '../services/serializers/notification-preference-serializer';
import { serializeErrors } from './utils/error';
import NotificationPreferenceService from '../services/push-notifications/preferences';

export interface NotificationType {
  id: string;
  notificationType: string;
  defaultStatus: 'enabled' | 'disabled';
}

export interface NotificationPreference {
  ownerAddress: string;
  pushClientId: string;
  notificationType: string;
  status: 'enabled' | 'disabled';
}

export default class NotificationPreferencesRoute {
  authenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  notificationTypeQueries: NotificationTypeQueries = inject('notification-type-queries', {
    as: 'notificationTypeQueries',
  });
  notificationPreferenceQueries: NotificationPreferenceQueries = inject('notification-preference-queries', {
    as: 'notificationPreferenceQueries',
  });
  notificationPreferenceSerializer: NotificationPreferenceSerializer = inject('notification-preference-serializer', {
    as: 'notificationPreferenceSerializer',
  });
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let preferences = await this.notificationPreferenceService.getPreferences(
      ctx.state.userAddress,
      ctx.params.push_client_id
    );

    let serialized = this.notificationPreferenceSerializer.serializeCollection(preferences);

    ctx.status = 200;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async put(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let pushClientId = ctx.params.push_client_id;
    let status = ctx.request.body.data.attributes['status'];
    let notificationType = ctx.request.body.data.attributes['notification-type'];

    if (!status || !notificationType) {
      let errors = {} as any;
      if (!status) errors['status'] = ['Must be present'];
      if (!notificationType) errors['notification-type'] = ['Must be present'];

      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    await this.notificationPreferenceQueries.upsert({
      ownerAddress: ctx.state.userAddress,
      pushClientId,
      notificationType,
      status,
    });

    let serialized = this.notificationPreferenceSerializer.serialize({
      ownerAddress: ctx.state.userAddress,
      pushClientId,
      notificationType,
      status,
    });

    ctx.status = 200;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'notification-preferences-route': NotificationPreferencesRoute;
  }
}
