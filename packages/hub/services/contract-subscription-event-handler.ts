import autoBind from 'auto-bind';
import WorkerClient from './worker-client';
import * as Sentry from '@sentry/node';
import Web3SocketService from './web3-socket';
import { contractSubscriptionEventHandlerLog } from '../utils/logger';
import Contracts from './contracts';
import { AddressKeys } from '@cardstack/cardpay-sdk';
import LatestEventBlockQueries from './queries/latest-event-block';

const CONTRACT_EVENTS = [
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
];

export class ContractSubscriptionEventHandler {
  #contracts: Contracts;
  #web3: Web3SocketService;
  #workerClient: WorkerClient;
  #latestEventBlockQueries: LatestEventBlockQueries;
  #logger = contractSubscriptionEventHandlerLog;

  constructor(
    web3: Web3SocketService,
    workerClient: WorkerClient,
    contracts: Contracts,
    latestEventBlockQueries: LatestEventBlockQueries
  ) {
    autoBind(this);
    this.#contracts = contracts;
    this.#web3 = web3;
    this.#workerClient = workerClient;
    this.#latestEventBlockQueries = latestEventBlockQueries;
  }

  async setupContractEventSubscriptions() {
    let web3Instance = this.#web3.getInstance();

    let subscriptionOptions = {};
    let latestBlock = await this.#latestEventBlockQueries.read();

    if (latestBlock) {
      subscriptionOptions = { fromBlock: latestBlock };
    }

    for (let contractEvent of CONTRACT_EVENTS) {
      let contract = await this.#contracts.getContract(web3Instance, contractEvent.abiName, contractEvent.contractName);

      contract.events[contractEvent.eventName](subscriptionOptions, async (error: Error, event: any) => {
        if (error) {
          Sentry.captureException(error, {
            tags: {
              action: 'contract-subscription-event-handler',
            },
          });
          this.#logger.error(`Error in ${contractEvent.contractName} subscription`, error);
        } else {
          this.#logger.info(
            `Received ${contractEvent.contractName} event (block number ${event.blockNumber})`,
            event.transactionHash
          );

          await this.#latestEventBlockQueries.update(event.blockNumber);
          this.#workerClient.addJob(contractEvent.taskName, event.transactionHash);
        }
      });
    }

    this.#logger.info('Subscribed to events');
  }
}
