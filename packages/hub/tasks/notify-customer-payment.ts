import { inject } from '@cardstack/di';
import config from 'config';
import CardpaySDKService from '../services/cardpay-sdk';
import MerchantInfoService from '../services/merchant-info';
import WorkerClient from '../services/worker-client';
import * as Sentry from '@sentry/node';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import { PushNotificationData } from './send-notifications';
import { generateContractEventNotificationId } from '../utils/notifications';
import omit from 'lodash/omit';

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

const { network } = config.get('web3') as { network: 'sokol' | 'xdai' };
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
  cardpay: CardpaySDKService = inject('cardpay');
  merchantInfo: MerchantInfoService = inject('merchant-info', { as: 'merchantInfo' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });

  async perform(payload: string) {
    await this.cardpay.waitForSubgraphIndex(payload, network);

    let queryResult: PrepaidCardPaymentsQueryResult = await this.cardpay.gqlQuery(network, prepaidCardPaymentsQuery, {
      txn: payload,
    });

    let result = queryResult?.data?.prepaidCardPayments?.[0];

    if (!result) {
      throw new Error(
        `Subgraph did not return information for prepaid card payment with transaction hash: "${payload}"`
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
          transactionHash: payload,
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
