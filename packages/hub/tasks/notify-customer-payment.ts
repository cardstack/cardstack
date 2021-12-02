import { inject } from '@cardstack/di';
import config from 'config';
import CardpaySDKService from '../services/cardpay-sdk';
import WorkerClient from '../services/worker-client';

export interface PrepaidCardPaymentsQueryResult {
  data: {
    prepaidCardPayments: {
      prepaidCardOwner: {
        id: string;
      };
      merchantSafe: {
        id: string;
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
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  async perform(payload: string) {
    await this.cardpay.waitForSubgraphIndex(payload, network);

    let queryResult: PrepaidCardPaymentsQueryResult = await this.cardpay.query(network, prepaidCardPaymentsQuery, {
      txn: payload,
    });

    let result = queryResult?.data?.prepaidCardPayments?.[0];

    if (!result) {
      throw new Error(
        `Subgraph did not return information for prepaid card payment with transaction hash: "${payload}"`
      );
    }

    // let merchantSafeAddress = result.merchantSafe.id;
    let notifiedAddress = result.merchant.id;
    let spendAmount = result.spendAmount;
    let message = `Your business received a payment of §${spendAmount}`;

    await this.workerClient.addJob('send-notifications', {
      notifiedAddress,
      message,
    });
  }
}
