import { Job, TaskSpec } from 'graphile-worker';
import { expect } from 'chai';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';
import Web3 from 'web3';

import { setupHub, registry } from '../helpers/server';
import { HISTORIC_BLOCKS_AVAILABLE } from '../../services/contract-subscription-event-handler';

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

let web3BlockNumber = 1234;

class StubWeb3 {
  getInstance() {
    return this;
  }

  get eth() {
    return this;
  }

  async getBlockNumber() {
    return Promise.resolve(web3BlockNumber);
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

    registry(this).register('contracts', StubContracts);
    registry(this).register('web3-socket', StubWeb3);
    registry(this).register('worker-client', StubWorkerClient);

    this.subject = await getContainer().lookup('contract-subscription-event-handler');
    this.contracts = (await getContainer().lookup('contracts')) as unknown as StubContracts;
    this.workerClient = (await getContainer().lookup('worker-client')) as unknown as StubWorkerClient;
    this.latestEventBlockQueries = await getContainer().lookup('latest-event-block-queries');

    web3BlockNumber = 1234;

    await this.subject.setupContractEventSubscriptions();
  });

  it('starts the event listeners with an empty config', async function () {
    expect(this.contracts.options.CustomerPayment).to.deep.equal({});
    expect(this.contracts.options.MerchantClaim).to.deep.equal({});
  });

  it('starts the event listeners with a fromBlock when the latest block has been persisted', async function () {
    await this.latestEventBlockQueries.update(1234);

    await this.subject.setupContractEventSubscriptions();

    expect(this.contracts.options.CustomerPayment).to.deep.equal({ fromBlock: 1234 });
    expect(this.contracts.options.MerchantClaim).to.deep.equal({ fromBlock: 1234 });
  });

  it('starts the event listener with the most-recently-available block when the latest block is more than 10000 ahead of the persisted block', async function () {
    await this.latestEventBlockQueries.update(web3BlockNumber);
    web3BlockNumber = web3BlockNumber + HISTORIC_BLOCKS_AVAILABLE * 2;

    await this.subject.setupContractEventSubscriptions();

    expect(this.contracts.options.CustomerPayment).to.deep.equal({
      fromBlock: web3BlockNumber - HISTORIC_BLOCKS_AVAILABLE + 1,
    });
    expect(this.contracts.options.MerchantClaim).to.deep.equal({
      fromBlock: web3BlockNumber - HISTORIC_BLOCKS_AVAILABLE + 1,
    });
  });

  it('handles a CustomerPayment event and persists the latest block', async function () {
    await this.contracts.handlers.CustomerPayment(null, { blockNumber: 500, transactionHash: '0x123' });

    expect(this.workerClient.jobs).to.deep.equal([['notify-customer-payment', '0x123']]);
    expect(await this.latestEventBlockQueries.read()).to.equal(500);
  });

  it('logs an error when receiving a CustomerPayment error', async function () {
    let error = new Error('Mock CustomerPayment error');
    this.contracts.handlers.CustomerPayment(error);

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'contract-subscription-event-handler',
    });

    expect(testkit.reports()[0].error?.message).to.equal(error.message);
  });

  it('handles a MerchantClaim event and persists the latest block', async function () {
    await this.latestEventBlockQueries.update(2324);
    await this.subject.setupContractEventSubscriptions();
    await this.contracts.handlers.MerchantClaim(null, { blockNumber: 1234, transactionHash: '0x123' });

    expect(await this.latestEventBlockQueries.read()).to.equal(2324);
  });

  it('ignores a block number that is lower than the persisted one', async function () {
    await this.contracts.handlers.MerchantClaim(null, { blockNumber: 2324, transactionHash: '0x123' });

    expect(this.workerClient.jobs).to.deep.equal([['notify-merchant-claim', '0x123']]);
    expect(await this.latestEventBlockQueries.read()).to.equal(2324);
  });

  it('logs an error when receiving a MerchantClaim error', async function () {
    let error = new Error('Mock MerchantClaim error');
    this.contracts.handlers.MerchantClaim(error);

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'contract-subscription-event-handler',
    });

    expect(testkit.reports()[0].error?.message).to.equal(error.message);
  });
});
