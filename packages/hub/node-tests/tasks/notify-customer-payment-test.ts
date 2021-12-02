import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import NotifyCustomerPayment, { PrepaidCardPaymentsQueryResult } from '../../tasks/notify-customer-payment';
import { expect } from 'chai';

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

class StubMerchantInfo {
  async getMerchantInfo(_did: string) {
    return {
      name: 'Mandello',
    };
  }
}

describe('NotifyCustomerPaymentTask', function () {
  this.beforeEach(function () {
    mockData.value = undefined;
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
      message: `Your business Mandello received a payment of §2324`,
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
