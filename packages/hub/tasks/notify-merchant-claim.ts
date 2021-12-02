import { inject } from '@cardstack/di';
import config from 'config';
import Web3 from 'web3';
import CardpaySDKService from '../services/cardpay-sdk';
import MerchantInfoService from '../services/merchant-info';
import WorkerClient from '../services/worker-client';

export interface MerchantClaimsQueryResult {
  data: {
    merchantClaims: {
      merchantSafe: {
        id: string;
        infoDid: string;
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

  async perform(payload: string) {
    await this.cardpay.waitForSubgraphIndex(payload, network);

    let queryResult: MerchantClaimsQueryResult = await this.cardpay.gqlQuery(network, merchantClaimsQuery, {
      txn: payload,
    });

    let result = queryResult?.data?.merchantClaims?.[0];

    if (!result) {
      throw new Error(`Subgraph did not return information for merchant claim with transaction hash: "${payload}"`);
    }

    let merchantName = '';

    try {
      let merchantInfo = await this.merchantInfo.getMerchantInfo(result.merchantSafe.infoDid);
      merchantName = ` ${merchantInfo.name}`;
    } catch (e) {
      // What is to be done? Sentry? Does it matter?
    }

    let token = result.token.symbol;
    let notifiedAddress = result.merchantSafe.merchant.id;
    let amountInWei = result.amount;

    let message = `You just claimed ${Web3.utils.fromWei(
      amountInWei
    )} ${token} from your${merchantName} business account`;

    await this.workerClient.addJob('send-notifications', {
      notifiedAddress,
      message,
    });
  }
}
