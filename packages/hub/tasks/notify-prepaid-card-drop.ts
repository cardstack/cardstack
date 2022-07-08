import { inject } from '@cardstack/di';
import { service } from '@cardstack/hub/services';
import config from 'config';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import WorkerClient from '../services/worker-client';
import { PushNotificationData } from './send-notifications';
import { generateContractEventNotificationId } from '../utils/notifications';
import { EventData } from 'web3-eth-contract';

const web3Config = config.get('web3') as { layer2Network: 'sokol' | 'gnosis' };

export default class NotifyPrepaidCardDrop {
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });
  workerClient: WorkerClient = service('worker-client', { as: 'workerClient' });

  async perform(event: EventData) {
    let notificationBody = 'You were issued a new prepaid card!';
    let ownerAddress = event.returnValues.owner;

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
          transactionHash: event.transactionHash,
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

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'notify-prepaid-card-drop': NotifyPrepaidCardDrop;
  }
}
