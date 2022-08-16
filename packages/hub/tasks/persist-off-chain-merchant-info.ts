import { Helpers } from 'graphile-worker';
import { inject } from '@cardstack/di';
import config from 'config';
import shortUuid from 'short-uuid';

export default class PersistOffChainMerchantInfo {
  profileSerializer = inject('profile-serializer', {
    as: 'profileSerializer',
  });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  async perform(payload: { id: string }, helpers: Helpers) {
    const { id } = payload;
    let prisma = await this.prismaManager.getClient();

    let profile = await prisma.profile.findUnique({ where: { id } });
    let jsonAPIDoc = this.profileSerializer.serialize(profile!, 'merchant-infos');

    helpers.addJob('s3-put-json', {
      bucket: config.get('aws.offchainStorage.bucketName'),
      path: `merchant-info/${shortUuid().fromUUID(id)}.json`,
      json: jsonAPIDoc,
      region: config.get('aws.offchainStorage.region'),
      roleChain: config.get('aws.offchainStorage.roleChain'),
    });
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'persist-off-chain-merchant-info': PersistOffChainMerchantInfo;
  }
}
