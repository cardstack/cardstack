import { Helpers } from 'graphile-worker';
import { inject } from '@cardstack/di';
import config from 'config';
import shortUuid from 'short-uuid';

export default class PersistOffChainProfile {
  profileSerializer = inject('profile-serializer', {
    as: 'profileSerializer',
  });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async perform(payload: { id: string; invalidate?: boolean }, helpers: Helpers) {
    const { id, invalidate } = payload;
    let prisma = await this.prismaManager.getClient();

    let profile = await prisma.profile.findUnique({ where: { id } });
    let jsonAPIDoc = this.profileSerializer.serialize(profile!);

    let putJobPayload: any = {
      bucket: config.get('aws.offchainStorage.bucketName'),
      path: `merchant-info/${shortUuid().fromUUID(id)}.json`,
      json: jsonAPIDoc,
      region: config.get('aws.offchainStorage.region'),
      roleChain: config.get('aws.offchainStorage.roleChain'),
    };

    if (invalidate) {
      try {
        putJobPayload.invalidateOnDistribution = config.get('aws.offchainStorage.cloudfrontDistributionId');
        putJobPayload.invalidationRoleChain = config.get('aws.offchainStorage.invalidationRoleChain');
      } catch (e) {
        console.log('Error adding invalidation', e);
      }
    }

    helpers.addJob('s3-put-json', putJobPayload);
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'persist-off-chain-profile': PersistOffChainProfile;
  }
}
