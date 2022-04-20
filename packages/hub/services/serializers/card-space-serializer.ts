import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import { CardSpace } from '../../routes/card-spaces';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

export default class CardSpaceSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(model: CardSpace): Promise<JSONAPIDocument> {
    let did = encodeDID({ type: 'CardSpace', uniqueId: model.id });

    const result = {
      meta: {
        network: config.get('web3.layer2Network'),
      },
      data: {
        id: model.id,
        type: 'card-spaces',
        attributes: {
          did,
          'profile-description': model.profileDescription,
          'profile-image-url': model.profileImageUrl,
          links: model.links,
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              id: model.merchantId,
            },
          },
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-space-serializer': CardSpaceSerializer;
  }
}
