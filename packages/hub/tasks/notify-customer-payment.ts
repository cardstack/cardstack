import { inject } from '@cardstack/di';
import { service } from '@cardstack/hub/services';
import config from 'config';
import CardpaySDKService from '../services/cardpay-sdk';
import MerchantInfoService from '../services/merchant-info';
import WorkerClient from '../services/worker-client';
import * as Sentry from '@sentry/node';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import { PushNotificationData } from './send-notifications';
import { generateContractEventNotificationId } from '../utils/notifications';
import omit from 'lodash/omit';
import { EventData } from 'web3-eth-contract';

export interface PrepaidCardPaymentsQueryResult {
  data: {
    prepaidCardPayments: {
      id: string;
      timestamp: string;
      spendAmount: string;
      issuingTokenAmount: string;
      issuingTokenUSDPrice: string;
      issuingToken: {
        id: string;
        symbol: string;
        name: string;
      };
      prepaidCard: {
        id: string;
        customizationDID?: string;
      };
      merchantSafe: {
        id: string;
        infoDid?: string;
      };
      transaction: {
        merchantFeePayments: {
          feeCollected: string;
          issuingToken: {
            symbol: string;
          };
        }[];
      };
      merchant: {
        id: string;
      };
    }[];
  };
}

const web3 = config.get('web3') as { layer2Network: 'sokol' | 'gnosis' };
const network = web3.layer2Network;
const prepaidCardPaymentsQuery = `
query($txn: String!) {
  prepaidCardPayments(where: { transaction: $txn }) {
    id
    timestamp
    spendAmount
    issuingTokenAmount
    issuingTokenUSDPrice
    issuingToken {
      id
      symbol
      name
    }
    prepaidCard {
      id
      customizationDID
    }
    merchantSafe {
      id
      infoDid
    }
    transaction {
      merchantFeePayments {
        feeCollected
        issuingToken {
          symbol
        }
      }
    }
    merchant {
      id
    }
  }
}
`;

export default class NotifyCustomerPayment {
  cardpay: CardpaySDKService = service('cardpay');
  merchantInfo: MerchantInfoService = service('merchant-info', { as: 'merchantInfo' });
  workerClient: WorkerClient = service('worker-client', { as: 'workerClient' });
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });

  async perform(contractEvent: EventData) {
    let transactionHash = contractEvent.transactionHash;
    await this.cardpay.waitForSubgraphIndex(transactionHash, network);

    let queryResult: PrepaidCardPaymentsQueryResult = await this.cardpay.gqlQuery(network, prepaidCardPaymentsQuery, {
      txn: transactionHash,
    });

    let result = queryResult?.data?.prepaidCardPayments?.[0];

    if (!result) {
      throw new Error(
        `Subgraph did not return information for prepaid card payment with transaction hash: "${transactionHash}"`
      );
    }

    let ownerAddress = result.merchant.id;

    let pushClientIdsForNotification = await this.notificationPreferenceService.getEligiblePushClientIds(
      ownerAddress,
      'customer_payment'
    );

    if (pushClientIdsForNotification.length === 0) {
      return;
    }

    let notificationBody = 'You have a new payment';

    try {
      if (result.merchantSafe?.infoDid) {
        let merchantInfo = await this.merchantInfo.getMerchantInfo(result.merchantSafe.infoDid);

        if (merchantInfo?.name) {
          notificationBody = `${merchantInfo.name} has a new payment`;
        }
      }
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'notify-customer-payment',
        },
      });
    }

    let notificationData = {
      notificationType: 'customer_payment',
      transactionInformation: JSON.stringify(omit(result, 'merchant')),
      ownerAddress,
      network,
    };

    for (const pushClientId of pushClientIdsForNotification) {
      let notification: PushNotificationData = {
        notificationId: generateContractEventNotificationId({
          network,
          ownerAddress,
          transactionHash,
          pushClientId,
        }),
        pushClientId,
        notificationBody,
        notificationType: 'customer_payment',
        notificationData,
      };
      await this.workerClient.addJob('send-notifications', notification, {
        jobKey: notification.notificationId,
        jobKeyMode: 'preserve_run_at',
        maxAttempts: 8, // 8th attempt is estimated to run at 28 mins. https://github.com/graphile/worker#exponential-backoff
      });
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'notify-customer-payment': NotifyCustomerPayment;
  }
}
