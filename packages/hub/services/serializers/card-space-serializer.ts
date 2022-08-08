import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { Profile } from '@prisma/client';

export default class CardSpaceSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(model: Partial<Profile> & Omit<Profile, 'createdAt' | 'links'>): Promise<JSONAPIDocument> {
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
              id: model.id,
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
