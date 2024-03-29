import { registry, setupHub } from '../helpers/server';
import NotifyMerchantClaim, {
  MerchantClaimsQueryResult,
  MERCHANT_CLAIM_EXPIRY_TIME,
} from '../../tasks/notify-merchant-claim';
import { expect } from 'chai';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import { EventData } from 'web3-eth-contract';

type TransactionInformation = MerchantClaimsQueryResult['data']['merchantClaims'][number];

const mockData: {
  value: TransactionInformation | undefined;
  queryReturnValue: MerchantClaimsQueryResult;
} = {
  value: undefined,
  get queryReturnValue() {
    return {
      data: {
        timestamp: '0', // because timestamp is 0, the sendBy will be the expiry time
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

describe('NotifyMerchantClaimTask', function () {
  setupSentry(this);
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(function () {
    mockData.value = undefined;
    merchantInfoShouldError = false;
    registry(this).register('cardpay', StubCardPay);
    registry(this).register('merchant-info', StubMerchantInfo);
    registry(this).register('notification-preference-service', StubNotificationPreferenceService);
  });
  let { getContainer } = setupHub(this);

  it('adds a send-notifications job for the merchant’s owner', async function () {
    mockData.value = {
      timestamp: '0',
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: 'did:cardstack:1m1C1LK4xoVSyybjNRcLB4APbc07954765987f62',
        merchant: {
          id: 'eoa-address',
        },
      },
      amount: '1155000000000000000000',
      token: {
        symbol: 'DAI.CPXD',
      },
    };
    let task = await getContainer().instantiate(NotifyMerchantClaim);

    await task.perform({ transactionHash: 'a' } as EventData);
    expect(getJobIdentifiers()).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(getJobPayloads()).to.deep.equal([
      {
        notificationBody: 'You claimed 1155 DAI.CPXD from Mandello',
        notificationId: 'sokol::a::123::eoa-address',
        notificationData: {
          notificationType: 'merchant_claim',
          transactionInformation: JSON.stringify({
            merchantId: 'merchant-safe-address',
          }),
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'merchant_claim',
        pushClientId: '123',
        sendBy: MERCHANT_CLAIM_EXPIRY_TIME,
      },
      {
        notificationBody: 'You claimed 1155 DAI.CPXD from Mandello',
        notificationId: 'sokol::a::456::eoa-address',
        notificationData: {
          notificationType: 'merchant_claim',
          transactionInformation: JSON.stringify({
            merchantId: 'merchant-safe-address',
          }),
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'merchant_claim',
        pushClientId: '456',
        sendBy: MERCHANT_CLAIM_EXPIRY_TIME,
      },
    ]);
  });

  it('omits the merchant name and logs an error when fetching it fails', async function () {
    merchantInfoShouldError = true;
    mockData.value = {
      timestamp: '0',
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: 'did:cardstack:1m1C1LK4xoVSyybjNRcLB4APbc07954765987f62',
        merchant: {
          id: 'eoa-address',
        },
      },
      amount: '1155000000000000000000',
      token: {
        symbol: 'DAI.CPXD',
      },
    };

    let task = await getContainer().instantiate(NotifyMerchantClaim);

    await task.perform({ transactionHash: 'a' } as EventData);

    expect(getJobIdentifiers()).to.deep.equal(['send-notifications', 'send-notifications']);

    expect(getJobPayloads()).to.deep.equal([
      {
        notificationBody: 'You claimed 1155 DAI.CPXD',
        notificationId: 'sokol::a::123::eoa-address',
        notificationData: {
          notificationType: 'merchant_claim',
          transactionInformation: JSON.stringify({
            merchantId: 'merchant-safe-address',
          }),
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'merchant_claim',
        pushClientId: '123',
        sendBy: MERCHANT_CLAIM_EXPIRY_TIME,
      },
      {
        notificationBody: 'You claimed 1155 DAI.CPXD',
        notificationId: 'sokol::a::456::eoa-address',
        notificationData: {
          notificationType: 'merchant_claim',
          transactionInformation: JSON.stringify({
            merchantId: 'merchant-safe-address',
          }),
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'merchant_claim',
        pushClientId: '456',
        sendBy: MERCHANT_CLAIM_EXPIRY_TIME,
      },
    ]);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'notify-merchant-claim',
    });
  });

  it('omits the merchant name when there is no DID', async function () {
    mockData.value = {
      timestamp: '0',
      merchantSafe: {
        id: 'merchant-safe-address',
        infoDid: undefined,
        merchant: {
          id: 'eoa-address',
        },
      },
      amount: '1155000000000000000000',
      token: {
        symbol: 'DAI.CPXD',
      },
    };

    let task = await getContainer().instantiate(NotifyMerchantClaim);

    await task.perform({ transactionHash: 'a' } as EventData);

    expect(getJobIdentifiers()).to.deep.equal(['send-notifications', 'send-notifications']);

    expect(getJobPayloads()).to.deep.equal([
      {
        notificationBody: 'You claimed 1155 DAI.CPXD',
        notificationId: 'sokol::a::123::eoa-address',
        notificationData: {
          notificationType: 'merchant_claim',
          transactionInformation: JSON.stringify({
            merchantId: 'merchant-safe-address',
          }),
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'merchant_claim',
        pushClientId: '123',
        sendBy: MERCHANT_CLAIM_EXPIRY_TIME,
      },
      {
        notificationBody: 'You claimed 1155 DAI.CPXD',
        notificationId: 'sokol::a::456::eoa-address',
        notificationData: {
          notificationType: 'merchant_claim',
          transactionInformation: JSON.stringify({
            merchantId: 'merchant-safe-address',
          }),
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'merchant_claim',
        pushClientId: '456',
        sendBy: MERCHANT_CLAIM_EXPIRY_TIME,
      },
    ]);
  });

  it('throws when the transaction is not found on the subgraph', async function () {
    let task = await getContainer().instantiate(NotifyMerchantClaim);

    return expect(task.perform({ transactionHash: 'a' } as EventData))
      .to.be.rejectedWith(`Subgraph did not return information for merchant claim with transaction hash: "a"`)
      .then(() => {
        expect(getJobIdentifiers()).to.deep.equal([]);
        expect(getJobPayloads()).to.deep.equal([]);
      });
  });
});
