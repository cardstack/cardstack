// fromWei is in both
import { getAddressByNetwork, getABI } from '@cardstack/cardpay-sdk';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import config from 'config';
import WorkerClient from './worker-client';

// TODO: figure out better way to type this + other config.get stuff?
const { network } = config.get('web3') as { network: 'xdai' | 'sokol' };

export class SafeEvents {
  private web3 = inject('web3-socket', { as: 'web3' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

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

    payMerchantContract.events.CustomerPayment({}, async (error: Error, event: any) => {
      if (error) {
        // TODO: log to sentry
        console.error('error in subscription', error);
      } else {
        this.workerClient.addJob('notify-customer-payment', event);
      }
    });

    revenuePoolContract.events.MerchantClaim({}, async (error: Error, event: any) => {
      if (error) {
        // TODO: log to sentry
        console.error('error in subscription', error);
      } else {
        this.workerClient.addJob('notify-merchant-claim', event);
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
