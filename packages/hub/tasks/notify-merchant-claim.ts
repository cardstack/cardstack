import { inject } from '@cardstack/di';
import config from 'config';
import Web3 from 'web3';
import CardpaySDKService from '../services/cardpay-sdk';
import MerchantInfoService from '../services/merchant-info';
import WorkerClient from '../services/worker-client';
import * as Sentry from '@sentry/node';
import NotificationPreferenceService from '../services/push-notifications/preferences';
import { PushNotificationData } from './send-notifications';

export interface MerchantClaimsQueryResult {
  data: {
    merchantClaims: {
      merchantSafe: {
        id: string;
        infoDid: string | undefined;
        merchant: {
          id: string;
        };
      };
      amount: string;
      token: { symbol: string };
    }[];
  };
}

const merchantClaimsQuery = `
query($txn: String!) {
  merchantClaims(where: { transaction: $txn }) {
    merchantSafe {
      id
      infoDid
      merchant {
        id
      }
    }
    amount
    token { symbol }
  }
}
`;

const { network } = config.get('web3') as { network: 'sokol' | 'xdai' };

export default class NotifyMerchantClaim {
  cardpay: CardpaySDKService = inject('cardpay');
  merchantInfo: MerchantInfoService = inject('merchant-info', { as: 'merchantInfo' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });
  notificationPreferenceService: NotificationPreferenceService = inject('notification-preference-service', {
    as: 'notificationPreferenceService',
  });

  async perform(payload: string) {
    await this.cardpay.waitForSubgraphIndex(payload, network);

    let queryResult: MerchantClaimsQueryResult = await this.cardpay.gqlQuery(network, merchantClaimsQuery, {
      txn: payload,
    });

    let result = queryResult?.data?.merchantClaims?.[0];

    if (!result) {
      throw new Error(`Subgraph did not return information for merchant claim with transaction hash: "${payload}"`);
    }

    let ownerAddress = result.merchantSafe.merchant.id;

    let pushClientIdsForNotification = await this.notificationPreferenceService.getEligiblePushClientIds(
      ownerAddress,
      'customer_payment'
    );

    if (pushClientIdsForNotification.length === 0) {
      return;
    }

    let merchantName = '';

    try {
      if (result.merchantSafe.infoDid) {
        let merchantInfo = await this.merchantInfo.getMerchantInfo(result.merchantSafe.infoDid);

        if (merchantInfo?.name) {
          merchantName = ` ${merchantInfo.name}`;
        }
      }
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'notify-merchant-claim',
        },
      });
    }

    let token = result.token.symbol;
    let amountInWei = result.amount;
    let notificationBody = `You just claimed ${Web3.utils.fromWei(
      amountInWei
    )} ${token} from your${merchantName} business account`;

    for (const pushClientId of pushClientIdsForNotification) {
      let notification: PushNotificationData = {
        ownerAddress,
        pushClientId,
        transactionHash: payload,
        notificationBody,
        notificationType: 'MerchantClaim',
      };

      await this.workerClient.addJob('send-notifications', notification);
    }
  }
}
