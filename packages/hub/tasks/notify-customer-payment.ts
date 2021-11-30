import { viewSafe } from '@cardstack/cardpay-sdk';
import { Helpers } from 'graphile-worker';
import config from 'config';

interface CustomerPaymentSubscriptionEvent {
  returnValues: {
    merchantSafe: string;
    spendAmount: string;
  };
}

const { network } = config.get('web3') as { network: 'xdai' | 'sokol' };

export default class NotifyCustomerPayment {
  async perform(payload: CustomerPaymentSubscriptionEvent, helpers: Helpers) {
    let { safe } = await viewSafe(network, payload.returnValues.merchantSafe);
    if (!safe) {
      // TODO: log to sentry;
      return;
    }
    let notifiedAddress = safe.owners[0];
    let message = `Your business received a payment of ${payload.returnValues.spendAmount} SPEND`;

    helpers.addJob('send-notifications', {
      notifiedAddress,
      message,
    });
  }
}
