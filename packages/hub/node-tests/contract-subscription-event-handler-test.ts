import { ContractSubscriptionEventHandler } from '../contract-subscription-event-handler';
import { Job, TaskSpec } from 'graphile-worker';
import { expect } from 'chai';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from './utils/wait-for';
import Web3SocketService from '../services/web3-socket';
import WorkerClient from '../services/worker-client';
import Contracts from '../services/contracts';
import Web3 from 'web3';

const { testkit, sentryTransport } = sentryTestkit();

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
    } else if (contractName == 'revenuePool') {
      return {
        events: {
          MerchantClaim: (_config: any, callback: Function) => {
            this.handlers.MerchantClaim = callback;
          },
        },
      };
    }

    return null;
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
    Sentry.init({
      dsn: 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001',
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });

    testkit.reset();

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
    contracts.handlers.CustomerPayment(null, { transactionHash: '0x123' });

    expect(workerClient.jobs).to.deep.equal([['notify-customer-payment', '0x123']]);
  });

  it('logs an error when receiving a CustomerPayment error', async function () {
    let error = new Error('Mock CustomerPayment error');
    contracts.handlers.CustomerPayment(error);

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'contract-subscription-event-handler',
    });

    expect(testkit.reports()[0].error?.message).to.equal(error.message);
  });

  it('handles a MerchantClaim event', async function () {
    contracts.handlers.MerchantClaim(null, { transactionHash: '0x123' });

    expect(workerClient.jobs).to.deep.equal([['notify-merchant-claim', '0x123']]);
  });

  it('logs an error when receiving a MerchantClaim error', async function () {
    let error = new Error('Mock MerchantClaim error');
    contracts.handlers.MerchantClaim(error);

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'contract-subscription-event-handler',
    });

    expect(testkit.reports()[0].error?.message).to.equal(error.message);
  });
});
