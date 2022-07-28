import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { Profile } from '@prisma/client';

export default class ProfileSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  serialize(model: Omit<Profile, 'links' | 'profileImageUrl' | 'profileDescription' | 'createdAt'>): JSONAPIDocument {
    let did = encodeDID({ type: 'MerchantInfo', uniqueId: model.id });

    const result = {
      meta: {
        network: config.get('web3.layer2Network'),
      },
      data: {
        id: model.id,
        type: 'merchant-infos',
        attributes: {
          did,
          name: model.name,
          slug: model.slug,
          color: model.color,
          'text-color': model.textColor,
          'owner-address': model.ownerAddress,
        },
      },
    };

    return result as JSONAPIDocument;
  }

  serializeCollection(models: Profile[]): JSONAPIDocument {
    let result = {
      data: models.map((model) => {
        return this.serialize(model).data;
      }),
    };

    return result as JSONAPIDocument;
  }

  deserialize(
    json: JSONAPIDocument
  ): Profile | Omit<Profile, 'links' | 'profileImageUrl' | 'profileDescription' | 'createdAt'> {
    return {
      id: json.data.id,
      name: json.data.attributes['name'],
      slug: json.data.attributes['slug'],
      color: json.data.attributes['color'],
      textColor: json.data.attributes['text-color'],
      ownerAddress: json.data.attributes['owner-address'],
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-info-serializer': ProfileSerializer;
  }
}
