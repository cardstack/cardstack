import { ContractSubscriptionEventHandler } from '../contract-subscription-event-handler';
import { Job, TaskSpec } from 'graphile-worker';
import { expect } from 'chai';
// import sentryTestkit from 'sentry-testkit';
// import * as Sentry from '@sentry/node';
// import waitFor from './utils/wait-for';
import Web3SocketService from '../services/web3-socket';
import WorkerClient from '../services/worker-client';
import { Contracts } from '../services/contracts';
import Web3 from 'web3';

// const { testkit, sentryTransport } = sentryTestkit();

class StubContracts {
  handlers: Record<any, any> = {};

  getContract(_web3: Web3, _abiName: string, contractName: string) {
    if (contractName == 'payMerchantHandler') {
      return {
        events: {
          CustomerPayment: (_config: any, callback: Function) => {
            this.handlers.CustomerPayment = callback;
          },
        },
      };
    }
    return {
      events: {
        MerchantClaim: (_config: any, callback: Function) => {
          this.handlers.CustomerPayment = callback;
        },
      },
    };
  }
}

class StubWeb3 {
  getInstance() {
    return this;
  }
}

class StubWorkerClient {
  jobs: [string, any][] = [];

  constructor() {
    this.jobs = [];
  }

  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    this.jobs.push([identifier, payload]);
    return Promise.resolve({} as Job);
  }
}

let contracts: StubContracts;
let workerClient: StubWorkerClient;

describe('ContractSubscriptionEventHandler', function () {
  this.beforeEach(async function () {
    contracts = new StubContracts();
    workerClient = new StubWorkerClient();

    this.subject = new ContractSubscriptionEventHandler(
      new StubWeb3() as unknown as Web3SocketService,
      workerClient as unknown as WorkerClient,
      contracts as unknown as Contracts
    );

    await this.subject.setupContractEventSubscriptions();
  });

  it('handles a CustomerPayment event', async function () {
    expect(1).to.equal(1);

    contracts.handlers.CustomerPayment(null, { transactionHash: '0x123' });

    expect(workerClient.jobs).to.deep.equal([['notify-merchant-claim', '0x123']]);
  });
});
