import { ContractSubscriptionEventHandler } from '../services/contract-subscription-event-handler';
import { Job, TaskSpec } from 'graphile-worker';
import { expect } from 'chai';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from './utils/wait-for';
import Web3SocketService from '../services/web3-socket';
import WorkerClient from '../services/worker-client';
import Contracts from '../services/contracts';
import Web3 from 'web3';
import LatestEventBlockQueries from '../services/queries/latest-event-block';
import { setupHub } from './helpers/server';

const { testkit, sentryTransport } = sentryTestkit();

class StubContracts {
  handlers: Record<any, any> = {};
  options: Record<string, any> = {};

  getContract(_web3: Web3, _abiName: string, contractName: string) {
    if (contractName == 'payMerchantHandler') {
      return {
        events: {
          CustomerPayment: (config: any, callback: Function) => {
            this.options.CustomerPayment = config;
            this.handlers.CustomerPayment = callback;
          },
        },
      };
    } else if (contractName == 'revenuePool') {
      return {
        events: {
          MerchantClaim: (config: any, callback: Function) => {
            this.options.MerchantClaim = config;
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
let latestEventBlockQueries: LatestEventBlockQueries;

describe('ContractSubscriptionEventHandler', function () {
  let { getContainer } = setupHub(this);

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

    latestEventBlockQueries = await getContainer().lookup('latest-event-block-queries');

    this.subject = new ContractSubscriptionEventHandler(
      new StubWeb3() as unknown as Web3SocketService,
      workerClient as unknown as WorkerClient,
      contracts as unknown as Contracts,
      latestEventBlockQueries
    );

    await this.subject.setupContractEventSubscriptions();
  });

  it('starts the event listeners with an empty config', async function () {
    expect(contracts.options.CustomerPayment).to.deep.equal({});
    expect(contracts.options.MerchantClaim).to.deep.equal({});
  });

  it('starts the event listeners with a fromBlock when the latest block has been persisted', async function () {
    await latestEventBlockQueries.update(1234);

    await this.subject.setupContractEventSubscriptions();

    expect(contracts.options.CustomerPayment).to.deep.equal({ fromBlock: 1234 });
    expect(contracts.options.MerchantClaim).to.deep.equal({ fromBlock: 1234 });
  });

  it('handles a CustomerPayment event and persists the latest block', async function () {
    await contracts.handlers.CustomerPayment(null, { blockNumber: 500, transactionHash: '0x123' });

    expect(workerClient.jobs).to.deep.equal([['notify-customer-payment', '0x123']]);
    expect(await latestEventBlockQueries.read()).to.equal(500);
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

  it('handles a MerchantClaim event and persists the latest block', async function () {
    await latestEventBlockQueries.update(2324);
    await this.subject.setupContractEventSubscriptions();
    await contracts.handlers.MerchantClaim(null, { blockNumber: 1234, transactionHash: '0x123' });

    expect(await latestEventBlockQueries.read()).to.equal(2324);
  });

  it('ignores a block number that is lower than the persisted one', async function () {
    await contracts.handlers.MerchantClaim(null, { blockNumber: 2324, transactionHash: '0x123' });

    expect(workerClient.jobs).to.deep.equal([['notify-merchant-claim', '0x123']]);
    expect(await latestEventBlockQueries.read()).to.equal(2324);
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
