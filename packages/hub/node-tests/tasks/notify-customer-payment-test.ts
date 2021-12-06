import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import NotifyCustomerPayment, { PrepaidCardPaymentsQueryResult } from '../../tasks/notify-customer-payment';
import { expect } from 'chai';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';

const { testkit, sentryTransport } = sentryTestkit();

type TransactionInformation = PrepaidCardPaymentsQueryResult['data']['prepaidCardPayments'][number];

const mockData: {
  value: TransactionInformation | undefined;
  queryReturnValue: PrepaidCardPaymentsQueryResult;
} = {
  value: undefined,
  get queryReturnValue() {
    return {
      data: {
        prepaidCardPayments: this.value ? [this.value] : [],
      },
    };
  },
};

class StubCardPay {
  async gqlQuery(_network: string, _query: string, _variables: { txn: string }) {
    return mockData.queryReturnValue;
  }

  async waitForSubgraphIndex(_txnHash: string) {
    return;
  }
}

let lastAddedJobIdentifier: string | undefined;
let lastAddedJobPayload: any | undefined;

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    lastAddedJobIdentifier = identifier;
    lastAddedJobPayload = payload;
    return Promise.resolve({} as Job);
  }
}

let merchantInfoShouldError = false;
class StubMerchantInfo {
  async getMerchantInfo(_did: string) {
    if (merchantInfoShouldError) {
      throw new Error('Simulated error fetching merchant info');
    } else {
      return {
        name: 'Mandello',
      };
    }
  }
}

describe('NotifyCustomerPaymentTask', function () {
  this.beforeEach(function () {
    mockData.value = undefined;
    merchantInfoShouldError = false;
    registry(this).register('cardpay', StubCardPay);
    registry(this).register('merchant-info', StubMerchantInfo);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('adds a send-notifications job for the merchant’s owner', async function () {
    mockData.value = {
      prepaidCardOwner: {
        id: 'prepaid-card-eoa-address',
      },
      merchant: {
        id: 'eoa-address',
      },
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: 'did:cardstack:1m1C1LK4xoVSyybjNRcLB4APbc07954765987f62',
      },
      issuingToken: {
        symbol: 'DAI.CPXD',
      },
      spendAmount: '2324',
      issuingTokenAmount: '23240000000000000000',
    };

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform('a');

    expect(lastAddedJobIdentifier).to.equal('send-notifications');
    expect(lastAddedJobPayload).to.deep.equal({
      notifiedAddress: 'eoa-address',
      message: `Mandello received a payment of §2324`,
    });
  });

  it('omits the merchant name and logs an error when fetching it fails', async function () {
    Sentry.init({
      dsn: 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001',
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });

    merchantInfoShouldError = true;
    mockData.value = {
      prepaidCardOwner: {
        id: 'prepaid-card-eoa-address',
      },
      merchant: {
        id: 'eoa-address',
      },
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: 'did:cardstack:1m1C1LK4xoVSyybjNRcLB4APbc07954765987f62',
      },
      issuingToken: {
        symbol: 'DAI.CPXD',
      },
      spendAmount: '2324',
      issuingTokenAmount: '23240000000000000000',
    };

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform('a');

    expect(lastAddedJobIdentifier).to.equal('send-notifications');
    expect(lastAddedJobPayload).to.deep.equal({
      notifiedAddress: 'eoa-address',
      message: `You received a payment of §2324`,
    });

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'notify-customer-payment',
    });
  });

  it('omits the merchant name when there is no DID', async function () {
    mockData.value = {
      prepaidCardOwner: {
        id: 'prepaid-card-eoa-address',
      },
      merchant: {
        id: 'eoa-address',
      },
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: undefined,
      },
      issuingToken: {
        symbol: 'DAI.CPXD',
      },
      spendAmount: '2324',
      issuingTokenAmount: '23240000000000000000',
    };

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform('a');

    expect(lastAddedJobIdentifier).to.equal('send-notifications');
    expect(lastAddedJobPayload).to.deep.equal({
      notifiedAddress: 'eoa-address',
      message: `You received a payment of §2324`,
    });
  });

  it('throws when the transaction is not found on the subgraph', async function () {
    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    return expect(task.perform('a'))
      .to.be.rejectedWith(`Subgraph did not return information for prepaid card payment with transaction hash: "a"`)
      .then(() => {
        expect(lastAddedJobIdentifier).to.be.undefined;
        expect(lastAddedJobPayload).to.be.undefined;
      });
  });
});
