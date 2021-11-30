import { inject } from '@cardstack/di';
import CardpaySDKService from '../services/cardpay-sdk';
import Web3Service from '../services/web3';
import WorkerClient from '../services/worker-client';

interface CustomerPaymentSubscriptionEvent {
  returnValues: {
    merchantSafe: string;
    spendAmount: string;
  };
}

export default class NotifyCustomerPayment {
  cardpay: CardpaySDKService = inject('cardpay');
  web3: Web3Service = inject('web3');
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  async perform(payload: CustomerPaymentSubscriptionEvent) {
    let Safes = await this.cardpay.getSDK('Safes', this.web3.getInstance());
    let { safe } = await Safes.viewSafe(payload.returnValues.merchantSafe);

    if (!safe) {
      throw new Error('Safe not found');
    }

    let notifiedAddress = safe.owners[0];
    let message = `Your business received a payment of §${payload.returnValues.spendAmount}`;

    await this.workerClient.addJob('send-notifications', {
      notifiedAddress,
      message,
    });
  }
}
