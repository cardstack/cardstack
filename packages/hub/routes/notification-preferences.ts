import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import { ensureLoggedIn } from './utils/auth';
import NotificationTypeQueries from '../services/queries/notification-type';
import NotificationPreferenceQueries from '../services/queries/notification-preference';
import NotificationPreferenceSerializer from '../services/serializers/notification-preference-serializer';

export interface NotificationType {
  id: string;
  notificationType: string;
  defaultStatus: 'enabled' | 'disabled';
}

export interface NotificationPreference {
  ownerAddress: string;
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

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let notificationTypes = await this.notificationTypeQueries.query();
    let notificationPreferences = await this.notificationPreferenceQueries.query({
      ownerAddress: ctx.state.userAddress,
    });

    let defaultPreferences = notificationTypes.map((nt) => {
      return { status: nt.defaultStatus, notificationType: nt.notificationType, ownerAddress: ctx.state.userAddress };
    });

    let preferences: NotificationPreference[] = defaultPreferences.map((defaultPreference) => {
      let preference = notificationPreferences.find(
        (preference) => preference.notificationType === defaultPreference.notificationType
      );
      if (preference) {
        return preference;
      } else {
        return defaultPreference;
      }
    });

    let serialized = this.notificationPreferenceSerializer.serializeCollection(preferences);

    ctx.status = 200;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let status = ctx.request.body.data.attributes['status'];
    let notificationType = ctx.request.body.data.attributes['notification-type'];

    let notificationPreference = (
      await this.notificationPreferenceQueries.query({
        ownerAddress: ctx.state.userAddress,
        notificationType,
      })
    )[0];

    if (notificationPreference) {
      await this.notificationPreferenceQueries.update({
        ownerAddress: ctx.state.userAddress,
        notificationType,
        status,
      });
    } else {
      await this.notificationPreferenceQueries.insert({
        ownerAddress: ctx.state.userAddress,
        notificationType,
        status,
      });
    }

    let serialized = this.notificationPreferenceSerializer.serialize({
      ownerAddress: ctx.state.userAddress,
      notificationType,
      status,
    });
    ctx.status = 201;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'notification-preferences-route': NotificationPreferencesRoute;
  }
}
