import { Job, TaskSpec } from 'graphile-worker';
import { expect } from 'chai';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import Web3 from 'web3';

import { setupHub, registry } from '../helpers/server';
import { HISTORIC_BLOCKS_AVAILABLE } from '../../services/contract-subscription-event-handler';

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

    throw new Error(`Unmocked contract ${contractName}`);
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

  setupSentry(this);

  this.beforeEach(async function () {
    registry(this).register('contracts', StubContracts);
    registry(this).register('web3-socket', StubWeb3);
    registry(this).register('worker-client', StubWorkerClient);

    this.subject = await getContainer().lookup('contract-subscription-event-handler');
    this.contracts = (await getContainer().lookup('contracts')) as unknown as StubContracts;
    this.workerClient = (await getContainer().lookup('worker-client')) as unknown as StubWorkerClient;
    this.latestEventBlockQueries = await getContainer().lookup('latest-event-block', { type: 'query' });

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
    let contractEvent = { blockNumber: 500, transactionHash: '0x123' };
    await this.contracts.handlers.CustomerPayment(null, contractEvent);

    expect(this.workerClient.jobs).to.deep.equal([['notify-customer-payment', contractEvent]]);
    expect(await this.latestEventBlockQueries.read()).to.equal(500);
  });

  it('logs an error when receiving a CustomerPayment error', async function () {
    let error = new Error('Mock CustomerPayment error');
    this.contracts.handlers.CustomerPayment(error);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'contract-subscription-event-handler',
    });

    expect(sentryReport.error?.message).to.equal(error.message);
  });

  it('handles a MerchantClaim event and persists the latest block', async function () {
    let contractEvent = { blockNumber: 1234, transactionHash: '0x123' };

    await this.latestEventBlockQueries.update(2324);
    await this.subject.setupContractEventSubscriptions();
    await this.contracts.handlers.MerchantClaim(null, contractEvent);

    expect(await this.latestEventBlockQueries.read()).to.equal(2324);
  });

  it('ignores a block number that is lower than the persisted one', async function () {
    let contractEvent = { blockNumber: 2324, transactionHash: '0x123' };
    await this.contracts.handlers.MerchantClaim(null, contractEvent);

    expect(this.workerClient.jobs).to.deep.equal([['notify-merchant-claim', contractEvent]]);
    expect(await this.latestEventBlockQueries.read()).to.equal(2324);
  });

  it('logs an error when receiving a MerchantClaim error', async function () {
    let error = new Error('Mock MerchantClaim error');
    this.contracts.handlers.MerchantClaim(error);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'contract-subscription-event-handler',
    });

    expect(sentryReport.error?.message).to.equal(error.message);
  });
});
