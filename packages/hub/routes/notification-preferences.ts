import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import { ensureLoggedIn } from './utils/auth';
import NotificationTypeQueries from '../services/queries/notification-type';
import NotificationPreferenceQueries from '../services/queries/notification-preference';
import NotificationPreferenceSerializer from '../services/serializers/notification-preference-serializer';
import { serializeErrors } from './utils/error';

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
      pushClientId: ctx.params.push_client_id,
    });

    let defaultPreferences = notificationTypes.map((nt) => {
      return {
        status: nt.defaultStatus,
        notificationType: nt.notificationType,
        ownerAddress: ctx.state.userAddress,
        pushClientId: ctx.params.push_client_id,
      };
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
    let pushClientId = ctx.request.body.data.attributes['push-client-id'];

    if (!status || !notificationType || !pushClientId) {
      let errors = {} as any;
      if (!status) errors['status'] = ['Must be present'];
      if (!notificationType) errors['notification-type'] = ['Must be present'];
      if (!pushClientId) errors['push-client-id'] = ['Must be present'];

      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let notificationPreference = (
      await this.notificationPreferenceQueries.query({
        ownerAddress: ctx.state.userAddress,
        pushClientId,
        notificationType,
      })
    )[0];

    if (notificationPreference) {
      await this.notificationPreferenceQueries.update({
        ownerAddress: ctx.state.userAddress,
        pushClientId,
        notificationType,
        status,
      });
    } else {
      await this.notificationPreferenceQueries.insert({
        ownerAddress: ctx.state.userAddress,
        pushClientId,
        notificationType,
        status,
      });
    }

    let serialized = this.notificationPreferenceSerializer.serialize({
      ownerAddress: ctx.state.userAddress,
      pushClientId,
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
