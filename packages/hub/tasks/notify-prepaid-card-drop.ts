import { inject } from '@cardstack/di';
import config from 'config';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import WorkerClient from '../services/worker-client';
import { PushNotificationData } from './send-notifications';
import { generateContractEventNotificationId } from '../utils/notifications';

const web3Config = config.get('web3') as { layer2Network: 'sokol' | 'xdai' };

export default class NotifyPrepaidCardDrop {
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  async perform(event: any) {
    let transactionHash = event.transactionHash;
    let ownerAddress = event.returnValues.owner;
    let notificationBody = 'You were issued a new prepaid card!';

    let notificationData = {
      notificationType: 'prepaid_card_drop',
      ownerAddress,
      network: web3Config.layer2Network,
    };

    let pushClientIdsForNotification = await this.notificationPreferenceService.getEligiblePushClientIds(
      ownerAddress,
      'prepaid_card_drop'
    );

    for (const pushClientId of pushClientIdsForNotification) {
      let notification: PushNotificationData = {
        notificationId: generateContractEventNotificationId({
          network: web3Config.layer2Network,
          ownerAddress,
          transactionHash,
          pushClientId,
        }),
        pushClientId,
        notificationBody,
        notificationData,
        notificationType: 'prepaid_card_drop',
      };

      await this.workerClient.addJob('send-notifications', notification, {
        jobKey: notification.notificationId,
        jobKeyMode: 'preserve_run_at',
      });
    }
  }
}
