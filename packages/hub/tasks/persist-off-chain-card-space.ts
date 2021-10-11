import { Helpers } from 'graphile-worker';
import CardSpaceSerializer from '../services/serializers/card-space-serializer';
import { inject } from '../di/dependency-injection';
import config from 'config';
import shortUuid from 'short-uuid';
import CardSpaceQueries from '../services/queries/card-space';

export default class PersistOffChainCardSpace {
  cardSpaceSerializer: CardSpaceSerializer = inject('card-space-serializer', {
    as: 'cardSpaceSerializer',
  });
  cardSpaceQueries: CardSpaceQueries = inject('card-space-queries', {
    as: 'cardSpaceQueries',
  });

  async perform(payload: any, helpers: Helpers) {
    const { id } = payload;

    let cardSpace = (await this.cardSpaceQueries.query({ id }))[0];
    let jsonAPIDoc = await this.cardSpaceSerializer.serialize(cardSpace);

    helpers.addJob('s3-put-json', {
      bucket: config.get('aws.offchainStorage.bucketName'),
      path: `card-space/${shortUuid().fromUUID(id)}.json`,
      json: jsonAPIDoc,
      region: config.get('aws.offchainStorage.region'),
      roleChain: config.get('aws.offchainStorage.roleChain'),
    });
  }
}
