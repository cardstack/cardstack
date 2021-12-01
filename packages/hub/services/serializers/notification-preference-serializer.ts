import { NotificationPreference } from '../../routes/notification-preferences';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class NotificationPreferenceSerializer {
  serialize(models: NotificationPreference[]): JSONAPIDocument {
    const result = {
      data: models.map((model) => {
        return {
          type: 'notification-preference',
          attributes: {
            'owner-address': model.ownerAddress,
            'notification-type': model.notificationType,
            status: model.status,
          },
        };
      }),
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'notification-preference-serializer': NotificationPreferenceSerializer;
  }
}
