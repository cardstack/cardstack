import { Helpers } from 'graphile-worker';
import { inject } from '@cardstack/di';
import config from 'config';
import shortUuid from 'short-uuid';
import { query } from '../queries';

export default class PersistOffChainMerchantInfo {
  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  merchantInfoQueries = query('merchant-info', {
    as: 'merchantInfoQueries',
  });

  async perform(payload: any, helpers: Helpers) {
    const { id } = payload;

    let merchantInfo = (await this.merchantInfoQueries.fetch({ id }))[0];
    let jsonAPIDoc = await this.merchantInfoSerializer.serialize(merchantInfo);

    helpers.addJob('s3-put-json', {
      bucket: config.get('aws.offchainStorage.bucketName'),
      path: `merchant-info/${shortUuid().fromUUID(id)}.json`,
      json: jsonAPIDoc,
      region: config.get('aws.offchainStorage.region'),
      roleChain: config.get('aws.offchainStorage.roleChain'),
    });
  }
}
