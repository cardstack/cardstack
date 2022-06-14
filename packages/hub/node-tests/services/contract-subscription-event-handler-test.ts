import { expect } from 'chai';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import Web3 from 'web3';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';

import { setupHub, registry } from '../helpers/server';
import { CONTRACT_EVENTS, HISTORIC_BLOCKS_AVAILABLE } from '../../services/contract-subscription-event-handler';

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
    } else if (contractName == 'prepaidCardMarketV2') {
      return {
        events: {
          PrepaidCardProvisioned: (config: any, callback: Function) => {
            this.options.PrepaidCardProvisioned = config;
            this.handlers.PrepaidCardProvisioned = callback;
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

describe('ContractSubscriptionEventHandler', function () {
  let { getContainer } = setupHub(this);

  setupSentry(this);
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(async function () {
    registry(this).register('contracts', StubContracts);
    registry(this).register('web3-socket', StubWeb3);

    this.subject = await getContainer().lookup('contract-subscription-event-handler');
    this.contracts = (await getContainer().lookup('contracts')) as unknown as StubContracts;
    this.latestEventBlockQueries = await getContainer().lookup('latest-event-block', { type: 'query' });

    web3BlockNumber = 1234;

    await this.subject.setupContractEventSubscriptions();
  });

  it('starts the event listeners with an empty config', async function () {
    expect(this.contracts.options.CustomerPayment).to.deep.equal({});
    expect(this.contracts.options.MerchantClaim).to.deep.equal({});
    expect(this.contracts.options.PrepaidCardProvisioned).to.deep.equal({});
  });

  it('starts the event listeners with a fromBlock when the latest block has been persisted', async function () {
    await this.latestEventBlockQueries.update(1234);

    await this.subject.setupContractEventSubscriptions();

    for (const contractOptionName in this.contracts.options) {
      expect(this.contracts.options[contractOptionName]).to.deep.equal({ fromBlock: 1234 });
    }
  });

  it('starts the event listener with the most-recently-available block when the latest block is more than 10000 ahead of the persisted block', async function () {
    await this.latestEventBlockQueries.update(web3BlockNumber);
    web3BlockNumber = web3BlockNumber + HISTORIC_BLOCKS_AVAILABLE * 2;

    await this.subject.setupContractEventSubscriptions();

    for (const contractOptionName in this.contracts.options) {
      expect(this.contracts.options[contractOptionName]).to.deep.equal({
        fromBlock: web3BlockNumber - HISTORIC_BLOCKS_AVAILABLE + 1,
      });
    }
  });

  for (const contractEventConfiguration of CONTRACT_EVENTS) {
    it(`handles a ${contractEventConfiguration} event and persists the latest block`, async function () {
      let contractEvent = {
        blockNumber: 500,
        transactionHash: '0x123',
      };

      await this.contracts.handlers[contractEventConfiguration.eventName](null, contractEvent);

      expect(getJobIdentifiers()[0]).to.equal(contractEventConfiguration.taskName);
      expect(getJobPayloads()[0]).to.deep.equal(contractEvent);
      expect(await this.latestEventBlockQueries.read()).to.equal(500);
    });

    it(`logs an error from ${contractEventConfiguration.eventName}`, async function () {
      let error = new Error(`Mock ${contractEventConfiguration.eventName} error`);
      this.contracts.handlers[contractEventConfiguration.eventName](error);

      let sentryReport = await waitForSentryReport();

      expect(sentryReport.tags).to.deep.equal({
        action: 'contract-subscription-event-handler',
      });

      expect(sentryReport.error?.message).to.equal(error.message);
    });
  }

  it('ignores a block number that is lower than the persisted one', async function () {
    let contractEvent = { blockNumber: 2324, transactionHash: '0x123' };
    await this.contracts.handlers.MerchantClaim(null, contractEvent);

    expect(getJobIdentifiers()[0]).to.equal('notify-merchant-claim');
    expect(getJobPayloads()[0]).to.deep.equal(contractEvent);
    expect(await this.latestEventBlockQueries.read()).to.equal(2324);
  });
});
