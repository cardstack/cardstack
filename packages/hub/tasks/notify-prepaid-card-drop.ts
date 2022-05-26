import { inject } from '@cardstack/di';
import config from 'config';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import WorkerClient from '../services/worker-client';
import { PushNotificationData } from './send-notifications';
import { generateContractEventNotificationId } from '../utils/notifications';

export const PREPAID_CARD_DROP_EXPIRY_TIME = 30 * 60 * 1000;

const web3Config = config.get('web3') as { layer2Network: 'sokol' | 'xdai' };

export default class NotifyPrepaidCardDrop {
  clock = inject('clock');
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  async perform({ transactionHash, ownerAddress }: { transactionHash: string; ownerAddress: string }) {
    let notificationBody = 'You were issued a new prepaid card!';

    let notificationData = {
      notificationType: 'prepaid_card_drop',
      ownerAddress,
      network: web3Config.layer2Network,
    };

    let pushClientIdsForNotification = await this.notificationPreferenceService.getEligiblePushClientIds(
      ownerAddress,
      'customer_payment'
    );

    for (const pushClientId of pushClientIdsForNotification) {
      let notification: PushNotificationData = {
        sendBy: this.clock.now() + PREPAID_CARD_DROP_EXPIRY_TIME,
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
        maxAttempts: 8, // 8th attempt is estimated to run at 28 mins. https://github.com/graphile/worker#exponential-backoff
      });
    }
  }
}
