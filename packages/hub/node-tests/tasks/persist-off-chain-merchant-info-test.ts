import { setupHub, setupRegistry } from '../helpers/server';
import shortUUID from 'short-uuid';
import { expect } from 'chai';
import { setupSentry } from '../helpers/sentry';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import PersistOffChainMerchantInfo from '../../tasks/persist-off-chain-merchant-info';
import { Profile } from '@prisma/client';
import config from 'config';

let profileId: string, profileShortId: string;

class StubProfileSerializer {
  serialize(model: Profile) {
    return model.id;
  }
}

describe('PersistOffChainMerchantInfo', function () {
  setupSentry(this);
  let { getHelpers, getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  setupRegistry(this, ['profile-serializer', StubProfileSerializer]);

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let prisma = await (await getContainer().lookup('prisma-manager')).getClient();
    profileId = shortUUID.uuid();
    profileShortId = shortUUID().fromUUID(profileId);

    await prisma.profile.create({
      data: {
        id: profileId,
        ownerAddress: '',
        name: '',
        slug: '',
        color: '',
        textColor: '',
      },
    });
  });

  it('adds an s3-put-json task', async function () {
    let task = await getContainer().instantiate(PersistOffChainMerchantInfo);

    await task.perform({ id: profileId }, getHelpers());

    expect(getJobIdentifiers()).to.deep.equal(['s3-put-json']);
    expect(getJobPayloads()).to.deep.equal([
      {
        bucket: config.get('aws.offchainStorage.bucketName'),
        json: profileId,
        path: `merchant-info/${profileShortId}.json`,
        region: config.get('aws.offchainStorage.region'),
        roleChain: ['prod:storage-bucket-writer-role'],
      },
    ]);
  });

  it('includes invalidation configuration when requested', async function () {
    let task = await getContainer().instantiate(PersistOffChainMerchantInfo);

    await task.perform({ id: profileId, invalidate: true }, getHelpers());

    expect(getJobIdentifiers()).to.deep.equal(['s3-put-json']);
    expect(getJobPayloads()).to.deep.equal([
      {
        bucket: config.get('aws.offchainStorage.bucketName'),
        json: profileId,
        path: `merchant-info/${profileShortId}.json`,
        region: config.get('aws.offchainStorage.region'),
        roleChain: ['prod:storage-bucket-writer-role'],
        invalidateOnDistribution: config.get('aws.offchainStorage.cloudfrontDistributionId'),
        invalidationRoleChain: config.get('aws.offchainStorage.invalidationRoleChain'),
      },
    ]);
  });
});
