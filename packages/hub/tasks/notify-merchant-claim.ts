import { fromWei, viewSafe } from '@cardstack/cardpay-sdk';
import { Helpers } from 'graphile-worker';
import config from 'config';

interface MerchantClaimSubscriptionEvent {
  returnValues: {
    merchantSafe: string;
    amount: string;
  };
}

const { network } = config.get('web3') as { network: 'xdai' | 'sokol' };

export default class NotifyMerchantClaim {
  async perform(payload: MerchantClaimSubscriptionEvent, helpers: Helpers) {
    let merchantSafeAddress = payload.returnValues.merchantSafe;
    let amountInWei = payload.returnValues.amount;

    let { safe } = await viewSafe(network, merchantSafeAddress);
    if (!safe) {
      // TODO: log to sentry
      return;
    }

    // TODO: how should we resolve the token symbol from an address?
    // let tokenAddress = event.returnValues.payableToken;
    let token = 'DAI.CPXD';
    let notifiedAddress = safe.owners[0];
    let message = `You just claimed ${fromWei(amountInWei)} ${token} from your business account`;

    helpers.addJob('send-notifications', {
      notifiedAddress,
      message,
    });
  }
}
