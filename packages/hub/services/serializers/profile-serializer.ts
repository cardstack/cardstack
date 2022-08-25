import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { Profile } from '@prisma/client';
import { ProfileMerchantSubset } from '../merchant-info';

type ResourceType = 'profiles' | 'card-spaces' | 'merchant-infos';

const propertyMappings: Record<string, keyof Profile> = {
  name: 'name',
  slug: 'slug',
  color: 'color',
  'text-color': 'textColor',
  'owner-address': 'ownerAddress',
  links: 'links',
  'profile-description': 'profileDescription',
  'profile-image-url': 'profileImageUrl',
};

export default class ProfileSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  serialize(model: Profile, type?: ResourceType): JSONAPIDocument;
  serialize(model: Profile[], type?: ResourceType): JSONAPIDocument;

  serialize(model: Profile | Profile[]): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => {
          return this.serialize(m).data;
        }),
      };
    } else {
      let did = encodeDID({ type: 'MerchantInfo', uniqueId: model.id });

      let attributes: any = { did };

      for (let key in propertyMappings) {
        attributes[key] = model[propertyMappings[key]];
      }

      const result: JSONAPIDocument = {
        meta: {
          network: config.get('web3.layer2Network'),
        },
        data: {
          id: model.id,
          type: 'profiles',
          attributes,
        },
      };

      return result as JSONAPIDocument;
    }
  }

  deserialize(json: JSONAPIDocument): ProfileMerchantSubset {
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
    'profile-serializer': ProfileSerializer;
  }
}
