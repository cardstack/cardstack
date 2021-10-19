import { Helpers } from 'graphile-worker';
import PrepaidCardCustomizationSerializer from '../services/serializers/prepaid-card-customization-serializer';
import { inject } from '@cardstack/di';
import config from 'config';
import shortUuid from 'short-uuid';

export default class PersistOffChainPrepaidCardCustomization {
  prepaidCardCustomizationSerializer: PrepaidCardCustomizationSerializer = inject(
    'prepaid-card-customization-serializer',
    { as: 'prepaidCardCustomizationSerializer' }
  );

  async perform(payload: any, helpers: Helpers) {
    const { id } = payload;
    let jsonAPIDoc = await this.prepaidCardCustomizationSerializer.serialize(id, {
      include: ['colorScheme', 'pattern'],
    });

    helpers.addJob('s3-put-json', {
      bucket: config.get('aws.offchainStorage.bucketName'),
      path: `prepaid-card-customization/${shortUuid().fromUUID(id)}.json`,
      json: jsonAPIDoc,
      region: config.get('aws.offchainStorage.region'),
      roleChain: config.get('aws.offchainStorage.roleChain'),
    });
  }
}
