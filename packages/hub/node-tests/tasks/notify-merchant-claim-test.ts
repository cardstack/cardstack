import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import { Safe } from '@cardstack/cardpay-sdk';
import NotifyMerchantClaim from '../../tasks/notify-merchant-claim';
import { toWei } from 'web3-utils';
import { expect } from 'chai';

let stubbedSafes: Record<string, Safe> = {};

class StubCardPay {
  getSDK(sdk: string) {
    if (sdk === 'Safes') {
      return {
        async viewSafe(safeAddress: string) {
          return {
            safe: stubbedSafes[safeAddress],
            blockNumber: 1,
          };
        },
      };
    } else {
      throw new Error('Attempted to access unstubbed SDK: ' + sdk);
    }
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
    registry(this).register('cardpay', StubCardPay);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('adds a send-notifications job for the merchant’s owner', async function () {
    stubbedSafes['0x1234'] = {
      type: 'merchant',
      owners: ['0xEOA'],
    } as Safe;

    let task = (await getContainer().lookup('notify-merchant-claim')) as NotifyMerchantClaim;

    await task.perform({
      returnValues: {
        merchantSafe: '0x1234',
        amount: toWei('1155'),
      },
    });

    expect(lastAddedJobIdentifier).to.equal('send-notifications');
    expect(lastAddedJobPayload).to.deep.equal({
      notifiedAddress: '0xEOA',
      message: `You just claimed 1155 DAI.CPXD from your business account`,
    });
  });

  it('throws when the safe is not found', async function () {
    let task = (await getContainer().lookup('notify-merchant-claim')) as NotifyMerchantClaim;

    return expect(
      task.perform({
        returnValues: {
          merchantSafe: 'no',
          amount: toWei('1155'),
        },
      })
    )
      .to.be.rejectedWith(/Safe not found/)
      .then(() => {
        expect(lastAddedJobIdentifier).to.be.undefined;
        expect(lastAddedJobPayload).to.be.undefined;
      });
  });
});
