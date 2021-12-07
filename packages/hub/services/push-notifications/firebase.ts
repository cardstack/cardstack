import admin from 'firebase-admin';

interface FCMPayload {
  message: {
    notification: {
      body: string;
      title: string;
      data: any; // TODO: Define deep link
    };
  };
  token: string;
}

export default class FirebasePushNotifications {
  async send(payload: FCMPayload) {
    await admin.messaging().send(payload);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'firebase-push-notifications': FirebasePushNotifications;
  }
}
