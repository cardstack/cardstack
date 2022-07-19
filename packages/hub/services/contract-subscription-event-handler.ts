import * as Sentry from '@sentry/node';
import { AddressKeys } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';

import logger from '@cardstack/logger';
import { EventData } from 'web3-eth-contract';

const log = logger('hub/contract-subscription-event-handler');

export const HISTORIC_BLOCKS_AVAILABLE = 10000;

type TasksWhichAcceptEventData = 'notify-merchant-claim' | 'notify-customer-payment' | 'notify-prepaid-card-drop';

interface ContractEventConfig {
  abiName: string;
  contractName: AddressKeys;
  eventName: string;
  taskName: TasksWhichAcceptEventData;
  contractStartVersion?: string;
}

export const CONTRACT_EVENTS: readonly ContractEventConfig[] = [
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
] as const;

export class ContractSubscriptionEventHandler {
  contracts = inject('contracts', { as: 'contracts' });
  web3 = inject('web3-socket', { as: 'web3' });
  workerClient = inject('worker-client', { as: 'workerClient' });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async setupContractEventSubscriptions() {
    let web3Instance = this.web3.getInstance();
    let prisma = await this.prismaManager.getClient();

    let subscriptionOptions = {};
    let subscriptionEventLatestBlock = await prisma.latestEventBlock.read();

    if (subscriptionEventLatestBlock) {
      let latestBlock = await web3Instance.eth.getBlockNumber();
      let fromBlock = Math.max(latestBlock - HISTORIC_BLOCKS_AVAILABLE + 1, subscriptionEventLatestBlock);

      subscriptionOptions = { fromBlock };
    }

    for (let contractEvent of CONTRACT_EVENTS) {
      let contract = await this.contracts.getContract(web3Instance, contractEvent.abiName, contractEvent.contractName);

      contract.events[contractEvent.eventName](subscriptionOptions, async (error: Error, event: EventData) => {
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
          await prisma.latestEventBlock.updateBlockNumber(event.blockNumber);
          this.workerClient.addJob<typeof CONTRACT_EVENTS[number]['taskName']>(contractEvent.taskName, event);
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
