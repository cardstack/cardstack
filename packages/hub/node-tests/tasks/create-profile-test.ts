import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import { expect } from 'chai';
import CreateProfile from '../../tasks/create-profile';

let addedJobIdentifiers: string[] = [];
let addedJobPayloads: string[] = [];

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    addedJobIdentifiers.push(identifier);
    addedJobPayloads.push(payload);
    return Promise.resolve({} as Job);
  }
}

describe('CreateProfileTask', function () {
  let subject: CreateProfile;

  let registeredAddress = '0x123';
  let registeredDid = 'sku';
  let mockTxnHash = '0x456';
  let registerProfileCalls = 0;
  let registeringShouldError = false;

  class StubRelayService {
    async registerProfile(userAddress: string, did: string) {
      registerProfileCalls++;

      if (registeringShouldError) {
        throw new Error('provisioning should error');
      }

      registeredAddress = userAddress;
      registeredDid = did;
      return Promise.resolve(mockTxnHash);
    }
  }

  this.beforeEach(function () {
    registry(this).register('relay', StubRelayService, { type: 'service' });
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    addedJobIdentifiers = [];
    addedJobPayloads = [];
  });

  this.beforeEach(async function () {
    subject = (await getContainer().lookup('create-profile')) as CreateProfile;
  });

  it('calls the relay server endpoint to register a profile and queues persist-off-chain-merchant-info', async function () {
    await subject.perform({
      'merchant-infos': {
        'owner-address': '0x000',
      },
    });

    expect(registerProfileCalls).to.equal(1);
    expect(registeredAddress).to.equal('0x000');
    expect(registeredDid).to.equal('fixme');

    expect(addedJobIdentifiers[0]).to.equal('persist-off-chain-merchant-info');
    expect(addedJobPayloads[0]).to.deep.equal({ 'merchant-safe-id': 'fixme' });
  });
});
