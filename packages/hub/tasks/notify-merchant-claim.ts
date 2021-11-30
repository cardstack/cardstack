import { fromWei } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';
import CardpaySDKService from '../services/cardpay-sdk';
import Web3HttpService from '../services/web3-http';
import WorkerClient from '../services/worker-client';

interface MerchantClaimSubscriptionEvent {
  returnValues: {
    merchantSafe: string;
    amount: string;
  };
}

export default class NotifyMerchantClaim {
  cardpay: CardpaySDKService = inject('cardpay');
  web3: Web3HttpService = inject('web3-http', { as: 'web3' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  async perform(payload: MerchantClaimSubscriptionEvent) {
    let merchantSafeAddress = payload.returnValues.merchantSafe;
    let amountInWei = payload.returnValues.amount;

    let Safes = await this.cardpay.getSDK('Safes', this.web3.getInstance());
    let { safe } = await Safes.viewSafe(merchantSafeAddress);

    if (!safe) {
      // Sufficient to log to Sentry because of on('job:error')…?
      throw new Error('Safe not found');
    }

    // TODO: how should we resolve the token symbol from an address?
    // let tokenAddress = event.returnValues.payableToken;
    let token = 'DAI.CPXD';
    let notifiedAddress = safe.owners[0];
    let message = `You just claimed ${fromWei(amountInWei)} ${token} from your business account`;

    await this.workerClient.addJob('send-notifications', {
      notifiedAddress,
      message,
    });
  }
}
