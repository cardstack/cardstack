import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import NotifyCustomerPayment, { PrepaidCardPaymentsQueryResult } from '../../tasks/notify-customer-payment';
import { expect } from 'chai';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';

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
  setupSentry(this);

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
      id: 'the-transaction-hash',
      timestamp: '1641555875',
      spendAmount: '2324',
      issuingTokenAmount: '23240000000000000000',
      issuingTokenUSDPrice: '1',
      merchant: {
        id: 'eoa-address',
      },
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: 'merchant-did',
      },
      prepaidCard: {
        id: 'prepaid-card-address',
        customizationDID: 'prepaid-card-did',
      },
      transaction: {
        merchantFeePayments: [
          {
            feeCollected: '5000000000000000',
            issuingToken: {
              symbol: 'DAI',
            },
          },
        ],
      },
      issuingToken: {
        id: 'dai-token-address',
        name: 'Dai Stablecoin.CPXD',
        symbol: 'DAI.CPXD',
      },
    };
    const mockNotificationData = {
      notificationType: 'customer_payment',
      transactionInformation: JSON.stringify({
        id: 'the-transaction-hash',
        timestamp: '1641555875',
        spendAmount: '2324',
        issuingTokenAmount: '23240000000000000000',
        issuingTokenUSDPrice: '1',
        merchantSafe: {
          id: 'merchant-safe-address',
          infoDid: 'merchant-did',
        },
        prepaidCard: {
          id: 'prepaid-card-address',
          customizationDID: 'prepaid-card-did',
        },
        transaction: {
          merchantFeePayments: [
            {
              feeCollected: '5000000000000000',
              issuingToken: {
                symbol: 'DAI',
              },
            },
          ],
        },
        issuingToken: {
          id: 'dai-token-address',
          name: 'Dai Stablecoin.CPXD',
          symbol: 'DAI.CPXD',
        },
      }),
      ownerAddress: 'eoa-address',
      network: 'sokol',
    };

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform('a');

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'Mandello has a new payment',
        notificationId: 'sokol::a::123::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '123',
        notificationData: mockNotificationData,
      },
      {
        notificationBody: 'Mandello has a new payment',
        notificationId: 'sokol::a::456::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '456',
        notificationData: mockNotificationData,
      },
    ]);
  });

  it('omits the merchant name and logs an error when fetching it fails', async function () {
    merchantInfoShouldError = true;
    mockData.value = {
      id: 'the-transaction-hash',
      timestamp: '1641555875',
      spendAmount: '2324',
      issuingTokenAmount: '23240000000000000000',
      issuingTokenUSDPrice: '1',
      merchant: {
        id: 'eoa-address',
      },
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: 'merchant-did',
      },
      prepaidCard: {
        id: 'prepaid-card-address',
        customizationDID: 'prepaid-card-did',
      },
      transaction: {
        merchantFeePayments: [
          {
            feeCollected: '5000000000000000',
            issuingToken: {
              symbol: 'DAI',
            },
          },
        ],
      },
      issuingToken: {
        id: 'dai-token-address',
        name: 'Dai Stablecoin.CPXD',
        symbol: 'DAI.CPXD',
      },
    };
    const mockNotificationData = {
      notificationType: 'customer_payment',
      transactionInformation: JSON.stringify({
        id: 'the-transaction-hash',
        timestamp: '1641555875',
        spendAmount: '2324',
        issuingTokenAmount: '23240000000000000000',
        issuingTokenUSDPrice: '1',
        merchantSafe: {
          id: 'merchant-safe-address',
          infoDid: 'merchant-did',
        },
        prepaidCard: {
          id: 'prepaid-card-address',
          customizationDID: 'prepaid-card-did',
        },
        transaction: {
          merchantFeePayments: [
            {
              feeCollected: '5000000000000000',
              issuingToken: {
                symbol: 'DAI',
              },
            },
          ],
        },
        issuingToken: {
          id: 'dai-token-address',
          name: 'Dai Stablecoin.CPXD',
          symbol: 'DAI.CPXD',
        },
      }),
      ownerAddress: 'eoa-address',
      network: 'sokol',
    };

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform('a');

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'You have a new payment',
        notificationId: 'sokol::a::123::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '123',
        notificationData: mockNotificationData,
      },
      {
        notificationBody: 'You have a new payment',
        notificationId: 'sokol::a::456::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '456',
        notificationData: mockNotificationData,
      },
    ]);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'notify-customer-payment',
    });
  });

  it('omits the merchant name when there is no DID', async function () {
    mockData.value = {
      id: 'the-transaction-hash',
      timestamp: '1641555875',
      spendAmount: '2324',
      issuingTokenAmount: '23240000000000000000',
      issuingTokenUSDPrice: '1',
      merchant: {
        id: 'eoa-address',
      },
      merchantSafe: {
        id: 'merchant-safe-address',
      },
      prepaidCard: {
        id: 'prepaid-card-address',
        customizationDID: 'prepaid-card-did',
      },
      transaction: {
        merchantFeePayments: [
          {
            feeCollected: '5000000000000000',
            issuingToken: {
              symbol: 'DAI',
            },
          },
        ],
      },
      issuingToken: {
        id: 'dai-token-address',
        name: 'Dai Stablecoin.CPXD',
        symbol: 'DAI.CPXD',
      },
    };
    const mockNotificationData = {
      notificationType: 'customer_payment',
      transactionInformation: JSON.stringify({
        id: 'the-transaction-hash',
        timestamp: '1641555875',
        spendAmount: '2324',
        issuingTokenAmount: '23240000000000000000',
        issuingTokenUSDPrice: '1',
        merchantSafe: {
          id: 'merchant-safe-address',
        },
        prepaidCard: {
          id: 'prepaid-card-address',
          customizationDID: 'prepaid-card-did',
        },
        transaction: {
          merchantFeePayments: [
            {
              feeCollected: '5000000000000000',
              issuingToken: {
                symbol: 'DAI',
              },
            },
          ],
        },
        issuingToken: {
          id: 'dai-token-address',
          name: 'Dai Stablecoin.CPXD',
          symbol: 'DAI.CPXD',
        },
      }),
      ownerAddress: 'eoa-address',
      network: 'sokol',
    };

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform('a');

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'You have a new payment',
        notificationId: 'sokol::a::123::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '123',
        notificationData: mockNotificationData,
      },
      {
        notificationBody: 'You have a new payment',
        notificationId: 'sokol::a::456::eoa-address',
        notificationType: 'customer_payment',
        pushClientId: '456',
        notificationData: mockNotificationData,
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
