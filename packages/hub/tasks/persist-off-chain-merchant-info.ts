import { Helpers } from 'graphile-worker';
import MerchantInfoSerializer from '../services/serializers/merchant-info-serializer';
import { inject } from '../di/dependency-injection';
import config from 'config';
import shortUuid from 'short-uuid';

export default class PersistOffChainMerchantInfo {
  merchantInfoSerializer: MerchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });

  async perform(payload: any, helpers: Helpers) {
    const { id } = payload;
    let jsonAPIDoc = await this.merchantInfoSerializer.serialize(id);

    helpers.addJob('s3-put-json', {
      bucket: config.get('aws.offchainStorage.bucketName'),
      path: `merchant-info/${shortUuid().fromUUID(id)}.json`,
      json: jsonAPIDoc,
      region: config.get('aws.offchainStorage.region'),
      roleChain: config.get('aws.offchainStorage.roleChain'),
    });
  }
}
