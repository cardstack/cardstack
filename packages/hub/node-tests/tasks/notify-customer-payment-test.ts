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

let addedJobIdentifiers: string[] = [];
let addedJobPayloads: string[] = [];

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    addedJobIdentifiers.push(identifier);
    addedJobPayloads.push(payload);
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

class StubNotificationPreferenceService {
  async getEligiblePushClientIds(_ownerAddress: string, _notificationType: string) {
    return ['123', '456'];
  }
}

describe('NotifyCustomerPaymentTask', function () {
  this.beforeEach(function () {
    mockData.value = undefined;
    merchantInfoShouldError = false;
    registry(this).register('cardpay', StubCardPay);
    registry(this).register('merchant-info', StubMerchantInfo);
    registry(this).register('worker-client', StubWorkerClient);
    registry(this).register('notification-preference-service', StubNotificationPreferenceService);
  });
  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    addedJobIdentifiers = [];
    addedJobPayloads = [];
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

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'Mandello received a payment of §2324',
        notificationId: 'sokol::a::123::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '123',
      },
      {
        notificationBody: 'Mandello received a payment of §2324',
        notificationId: 'sokol::a::456::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '456',
      },
    ]);
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

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'You received a payment of §2324',
        notificationId: 'sokol::a::123::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '123',
      },
      {
        notificationBody: 'You received a payment of §2324',
        notificationId: 'sokol::a::456::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '456',
      },
    ]);

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

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'You received a payment of §2324',
        notificationId: 'sokol::a::123::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '123',
      },
      {
        notificationBody: 'You received a payment of §2324',
        notificationId: 'sokol::a::456::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '456',
      },
    ]);
  });

  it('throws when the transaction is not found on the subgraph', async function () {
    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    return expect(task.perform('a'))
      .to.be.rejectedWith(`Subgraph did not return information for prepaid card payment with transaction hash: "a"`)
      .then(() => {
        expect(addedJobIdentifiers).to.deep.equal([]);
        expect(addedJobPayloads).to.deep.equal([]);
      });
  });
});
