// fromWei is in both
import { getAddressByNetwork, getABI, viewSafe, fromWei } from '@cardstack/cardpay-sdk';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import config from 'config';

// TODO: figure out better way to type this + other config.get stuff?
const { network } = config.get('web3') as { network: 'xdai' | 'sokol' };

export class SafeEvents {
  private web3 = inject('web3-socket', { as: 'web3' });

  constructor() {
    autoBind(this);
  }

  async initialize() {
    console.log(this);
    let web3Instance = this.web3.getInstance();

    let RevenuePoolABI = await getABI('revenue-pool', web3Instance);
    let revenuePoolContract = new web3Instance.eth.Contract(
      RevenuePoolABI,
      getAddressByNetwork('revenuePool', network)
    );

    let PayMerchantHandlerABI = await getABI('pay-merchant-handler', web3Instance);
    let payMerchantContract = new web3Instance.eth.Contract(
      PayMerchantHandlerABI,
      getAddressByNetwork('payMerchantHandler', network)
    );

    payMerchantContract.events.CustomerPayment({}, async function (error: Error, event: any) {
      if (error) {
        // TODO: log to sentry
        console.error('error in subscription', error);
      } else {
        let { safe } = await viewSafe(network, event.returnValues.merchantSafe);
        if (!safe) {
          // TODO: log to sentry;
          return;
        }
        console.log('event and relevant safe', event, safe.owners[0]);
        console.log(safe.owners[0], `Your business received a payment of ${event.returnValues.spendAmount} SPEND`);
      }
    });

    revenuePoolContract.events.MerchantClaim({}, async function (error: Error, event: any) {
      if (error) {
        // TODO: log to sentry
        console.error('error in subscription', error);
      } else {
        // let tokenAddress = event.returnValues.payableToken;
        let merchantSafeAddress = event.returnValues.merchantSafe;
        let amountInWei = event.returnValues.amount;

        let { safe } = await viewSafe(network, merchantSafeAddress);
        if (!safe) {
          // TODO: log to sentry;
          return;
        }

        console.log('event and EOA', event, safe.owners[0]);
        console.log(`Your just claimed ${fromWei(amountInWei)} DAI.CPXD from your business account`);
      }
    });

    console.log('ready');
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'safe-events': SafeEvents;
  }
}
