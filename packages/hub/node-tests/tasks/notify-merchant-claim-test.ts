import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import NotifyMerchantClaim, { MerchantClaimsQueryResult } from '../../tasks/notify-merchant-claim';
import { expect } from 'chai';

type TransactionInformation = MerchantClaimsQueryResult['data']['merchantClaims'][number];

const mockData: {
  value: TransactionInformation | undefined;
  queryReturnValue: MerchantClaimsQueryResult;
} = {
  value: undefined,
  get queryReturnValue() {
    return {
      data: {
        merchantClaims: this.value ? [this.value] : [],
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

describe('NotifyMerchantClaimTask', function () {
  this.beforeEach(function () {
    mockData.value = undefined;
    registry(this).register('cardpay', StubCardPay);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('adds a send-notifications job for the merchant’s owner', async function () {
    mockData.value = {
      merchantSafe: {
        id: 'merchant-safe-address',
        merchant: {
          id: 'eoa-address',
        },
      },
      amount: '1155000000000000000000',
      token: {
        symbol: 'DAI.CPXD',
      },
    };
    let task = (await getContainer().lookup('notify-merchant-claim')) as NotifyMerchantClaim;

    await task.perform('a');

    expect(lastAddedJobIdentifier).to.equal('send-notifications');
    expect(lastAddedJobPayload).to.deep.equal({
      notifiedAddress: 'eoa-address',
      message: `You just claimed 1155 DAI.CPXD from your business account`,
    });
  });

  it('throws when the transaction is not found on the subgraph', async function () {
    let task = (await getContainer().lookup('notify-merchant-claim')) as NotifyMerchantClaim;

    return expect(task.perform('a'))
      .to.be.rejectedWith(`Subgraph did not return information for merchant claim with transaction hash: "a"`)
      .then(() => {
        expect(lastAddedJobIdentifier).to.be.undefined;
        expect(lastAddedJobPayload).to.be.undefined;
      });
  });
});
