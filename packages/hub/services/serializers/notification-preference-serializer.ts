import { NotificationPreference } from '../../routes/notification-preferences';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class NotificationPreferenceSerializer {
  serialize(model: NotificationPreference): JSONAPIDocument {
    return {
      data: {
        type: 'notification-preference',
        attributes: {
          'owner-address': model.ownerAddress,
          'push-client-id': model.pushClientId,
          'notification-type': model.notificationType,
          status: model.status,
        },
      },
    };
  }

  serializeCollection(models: NotificationPreference[]): JSONAPIDocument {
    const result = {
      data: models.map((model) => {
        return this.serialize(model).data;
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
