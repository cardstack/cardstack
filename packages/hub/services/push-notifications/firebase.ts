import admin from 'firebase-admin';
import { TokenMessage } from 'firebase-admin/lib/messaging/messaging-api';

export default class FirebasePushNotifications {
  async send(payload: TokenMessage) {
    return await admin.messaging().send(payload);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'firebase-push-notifications': FirebasePushNotifications;
  }
}
