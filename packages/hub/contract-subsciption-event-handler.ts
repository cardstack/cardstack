import { getAddressByNetwork, getABI } from '@cardstack/cardpay-sdk';
import autoBind from 'auto-bind';
import { inject, injectionReady } from '@cardstack/di';
import config from 'config';
import WorkerClient from './services/worker-client';
import * as Sentry from '@sentry/node';
import { contractSubscriptionEventHandlerLog } from './utils/logger';

const { network } = config.get('web3') as { network: 'xdai' | 'sokol' };

export class ContractSubscriptionEventHandler {
  private web3 = inject('web3-socket', { as: 'web3' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });
  logger = contractSubscriptionEventHandlerLog;

  constructor() {
    autoBind(this);
  }

  async ready() {
    await Promise.all([injectionReady(this, 'web3-socket'), injectionReady(this, 'worker-client')]);
    await this.setupContractEventSubscriptions();
  }

  async setupContractEventSubscriptions() {
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
        Sentry.captureException(error, {
          tags: {
            action: 'contract-subscription-event-handler',
          },
        });
        this.logger.error('Error in CustomerPayment subscription', error);
      } else {
        this.logger.info('Received CustomerPayment event', event.transactionHash);
        this.workerClient.addJob('notify-customer-payment', event.transactionHash);
      }
    });

    revenuePoolContract.events.MerchantClaim({}, async (error: Error, event: any) => {
      if (error) {
        Sentry.captureException(error, {
          tags: {
            action: 'contract-subscription-event-handler',
          },
        });
        this.logger.error('Error in MerchantClaim subscription', error);
      } else {
        this.logger.info('Received MerchantClaim event', event.transactionHash);
        this.workerClient.addJob('notify-merchant-claim', event.transactionHash);
      }
    });

    this.logger.info('Subscribed to events');
  }
}
