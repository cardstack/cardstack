import autoBind from 'auto-bind';
import WorkerClient from './services/worker-client';
import * as Sentry from '@sentry/node';
import Web3SocketService from './services/web3-socket';
import { contractSubscriptionEventHandlerLog } from './utils/logger';
import Contracts from './services/contracts';
import { AddressKeys } from '@cardstack/cardpay-sdk';

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

// DO NOT USE only for use in bootWorker to prevent duplicate notifications
export class ContractSubscriptionEventHandler {
  #contracts: Contracts;
  #web3: Web3SocketService;
  #workerClient: WorkerClient;
  #logger = contractSubscriptionEventHandlerLog;

  constructor(web3: Web3SocketService, workerClient: WorkerClient, contracts: Contracts) {
    autoBind(this);
    this.#contracts = contracts;
    this.#web3 = web3;
    this.#workerClient = workerClient;
  }

  async setupContractEventSubscriptions() {
    let web3Instance = this.#web3.getInstance();

    for (let contractEvent of CONTRACT_EVENTS) {
      let contract = await this.#contracts.getContract(web3Instance, contractEvent.abiName, contractEvent.contractName);

      contract.events[contractEvent.eventName]({}, async (error: Error, event: any) => {
        if (error) {
          Sentry.captureException(error, {
            tags: {
              action: 'contract-subscription-event-handler',
            },
          });
          this.#logger.error(`Error in ${contractEvent.contractName} subscription`, error);
        } else {
          this.#logger.info(`Received ${contractEvent.contractName} event`, event.transactionHash);
          this.#workerClient.addJob(contractEvent.taskName, event.transactionHash);
        }
      });
    }

    this.#logger.info('Subscribed to events');
  }
}
