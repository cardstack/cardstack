import { inject } from '@cardstack/di';
import config from 'config';
import CardpaySDKService from '../services/cardpay-sdk';
import MerchantInfoService from '../services/merchant-info';
import WorkerClient from '../services/worker-client';
import * as Sentry from '@sentry/node';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import { PushNotificationData } from '../services/queries/sent-push-notifications';

export interface PrepaidCardPaymentsQueryResult {
  data: {
    prepaidCardPayments: {
      prepaidCardOwner: {
        id: string;
      };
      merchantSafe: {
        id: string;
        infoDid: string | undefined;
      };
      merchant: {
        id: string;
      };
      issuingToken: {
        symbol: string;
      };
      issuingTokenAmount: string;
      spendAmount: string;
    }[];
  };
}

const { network } = config.get('web3') as { network: 'sokol' | 'xdai' };
const prepaidCardPaymentsQuery = `
query($txn: String!) {
  prepaidCardPayments(where: { transaction: $txn }) {
    prepaidCardOwner {
      id
    }
    merchantSafe {
      id
      infoDid
    }
    merchant {
      id
    }
    issuingToken {
      symbol
    }
    issuingTokenAmount
    spendAmount
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

    let merchantName = 'You';

    try {
      if (result.merchantSafe?.infoDid) {
        let merchantInfo = await this.merchantInfo.getMerchantInfo(result.merchantSafe.infoDid);

        if (merchantInfo?.name) {
          merchantName = merchantInfo.name;
        }
      }
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'notify-customer-payment',
        },
      });
    }

    let spendAmount = result.spendAmount;
    let notificationBody = `${merchantName} received a payment of §${spendAmount}`;

    for (const pushClientId of pushClientIdsForNotification) {
      let notification: PushNotificationData = {
        ownerAddress,
        pushClientId,
        transactionHash: payload,
        notificationBody,
        notificationType: 'CustomerPayment',
      };
      await this.workerClient.addJob('send-notifications', notification);
    }
  }
}
