import * as Sentry from '@sentry/node';
import { AddressKeys } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';

import logger from '@cardstack/logger';
import { query } from '@cardstack/hub/queries';
const log = logger('hub/contract-subscription-event-handler');

export const HISTORIC_BLOCKS_AVAILABLE = 10000;

export const CONTRACT_EVENTS = [
  {
    abiName: 'pay-merchant-handler',
    contractName: 'payMerchantHandler' as AddressKeys,
    eventName: 'CustomerPayment',
    taskName: 'notify-customer-payment',
  },
  {
    abiName: 'revenue-pool',
    contractName: 'revenuePool' as AddressKeys,
    eventName: 'MerchantClaim',
    taskName: 'notify-merchant-claim',
  },
  {
    abiName: 'prepaid-card-market-v-2',
    contractName: 'prepaidCardMarketV2' as AddressKeys,
    eventName: 'PrepaidCardProvisioned',
    taskName: 'notify-prepaid-card-drop',
    contractStartVersion: '0.9.0',
  },
];

export class ContractSubscriptionEventHandler {
  contracts = inject('contracts', { as: 'contracts' });
  web3 = inject('web3-socket', { as: 'web3' });
  workerClient = inject('worker-client', { as: 'workerClient' });
  latestEventBlockQueries = query('latest-event-block', { as: 'latestEventBlockQueries' });

  async setupContractEventSubscriptions() {
    let web3Instance = this.web3.getInstance();

    let subscriptionOptions = {};
    let subscriptionEventLatestBlock = await this.latestEventBlockQueries.read();

    if (subscriptionEventLatestBlock) {
      let latestBlock = await web3Instance.eth.getBlockNumber();
      let fromBlock = Math.max(latestBlock - HISTORIC_BLOCKS_AVAILABLE + 1, subscriptionEventLatestBlock);

      subscriptionOptions = { fromBlock };
    }

    for (let contractEvent of CONTRACT_EVENTS) {
      let contract = await this.contracts.getContract(web3Instance, contractEvent.abiName, contractEvent.contractName);

      contract.events[contractEvent.eventName](subscriptionOptions, async (error: Error, event: any) => {
        if (error) {
          Sentry.captureException(error, {
            tags: {
              action: 'contract-subscription-event-handler',
            },
          });
          log.error(`Error in ${contractEvent.contractName} subscription`, error);
        } else {
          log.info(
            `Received ${contractEvent.contractName} event (block number ${event.blockNumber})`,
            event.transactionHash
          );
          log.info(JSON.stringify(event, null, 2));

          await this.latestEventBlockQueries.update(event.blockNumber);
          this.workerClient.addJob(contractEvent.taskName, event.transactionHash);
        }
      });
    }

    log.info('Subscribed to events');
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'contract-subscription-event-handler': ContractSubscriptionEventHandler;
  }
}
