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

  this.beforeEach(function () {
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

  it('queues persist-off-chain-merchant-info', async function () {
    await subject.perform({});

    expect(addedJobIdentifiers[0]).to.equal('persist-off-chain-merchant-info');
    expect(addedJobPayloads[0]).to.deep.equal({ 'merchant-safe-id': 'fixme' });
  });
});
