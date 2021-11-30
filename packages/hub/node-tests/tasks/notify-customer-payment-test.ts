import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import { Safe } from '@cardstack/cardpay-sdk';
import NotifyCustomerPayment from '../../tasks/notify-customer-payment';
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

describe('NotifyCustomerPaymentTask', function () {
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

    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    await task.perform({
      returnValues: {
        merchantSafe: '0x1234',
        spendAmount: '2324',
      },
    });

    expect(lastAddedJobIdentifier).to.equal('send-notifications');
    expect(lastAddedJobPayload).to.deep.equal({
      notifiedAddress: '0xEOA',
      message: `Your business received a payment of §2324`,
    });
  });

  it('throws when the safe is not found', async function () {
    let task = (await getContainer().lookup('notify-customer-payment')) as NotifyCustomerPayment;

    return expect(
      task.perform({
        returnValues: {
          merchantSafe: 'no',
          spendAmount: '2324',
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
