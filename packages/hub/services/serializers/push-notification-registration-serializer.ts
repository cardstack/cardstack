import { PushNotificationRegistration } from '../../routes/push_notification_registrations';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class PushNotificationRegistrationSerializer {
  serialize(model: PushNotificationRegistration): JSONAPIDocument {
    const result = {
      data: {
        id: model.id,
        type: 'push-notification-registration',
        attributes: {
          'owner-address': model.ownerAddress,
          'push-client-id': model.pushClientId,
          'disabled-at': model.disabledAt,
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'push-notification-registration-serializer': PushNotificationRegistrationSerializer;
  }
}
