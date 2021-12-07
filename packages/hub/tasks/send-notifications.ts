import { inject } from '@cardstack/di';
import { Helpers } from 'graphile-worker';

export default class SendNotificationsTask {
  sentPushNotificationsQueries = inject('sent-push-notifications-queries', { as: 'sentPushNotificationsQueries' });

  async perform(payload: any, helpers: Helpers) {
    let index = {
      transactionHash: payload.transactionHash,
      pushClientId: payload.pushClientId,
      ownerAddress: payload.ownerAddress,
    };

    let notificationHasBeenSent = await this.sentPushNotificationsQueries.exists(index);
    if (notificationHasBeenSent) {
      helpers.logger.info('Not sending notification because it has already been sent');
      return;
    }

    helpers.logger.info('Notification to send:', payload);
    this.sentPushNotificationsQueries.insert(payload);
  }
}
