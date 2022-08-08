import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { Profile } from '@prisma/client';
import { ProfileMerchantSubset } from '../merchant-info';

type ResourceType = 'profiles' | 'card-spaces' | 'merchant-infos';

const cardSpacesMapping: Record<string, keyof Profile> = {
  links: 'links',
  'profile-description': 'profileDescription',
  'profile-image-url': 'profileImageUrl',
};

const merchantInfosMapping: Record<string, keyof Profile> = {
  name: 'name',
  slug: 'slug',
  color: 'color',
  'text-color': 'textColor',
  'owner-address': 'ownerAddress',
};

export default class ProfileSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  serialize(model: Profile, type?: ResourceType): JSONAPIDocument;
  serialize(model: Profile[], type?: ResourceType): JSONAPIDocument;

  serialize(model: Profile | Profile[], type: ResourceType = 'profiles'): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => {
          return this.serialize(m).data;
        }),
      };
    } else {
      // FIXME what is to be done with this type?
      let did = encodeDID({ type: 'MerchantInfo', uniqueId: model.id });

      let attributes: any = { did };
      let propertyMappings;

      if (type === 'profiles') {
        propertyMappings = { ...merchantInfosMapping, ...cardSpacesMapping };
      } else if (type === 'merchant-infos') {
        propertyMappings = merchantInfosMapping;
      } else if (type === 'card-spaces') {
        propertyMappings = cardSpacesMapping;
      }

      for (let key in propertyMappings) {
        attributes[key] = model[propertyMappings[key]];
      }

      const result: JSONAPIDocument = {
        meta: {
          network: config.get('web3.layer2Network'),
        },
        data: {
          id: model.id,
          type,
          attributes,
        },
      };

      if (type === 'card-spaces') {
        result.data.relationships = { 'merchant-info': { data: { id: model.id, type: 'merchant-infos' } } };
        let includedAttributes: any = { did };

        for (let key in merchantInfosMapping) {
          includedAttributes[key] = model[merchantInfosMapping[key]];
        }

        result.included = [{ attributes: includedAttributes, id: model.id, type: 'merchant-infos' }];
      }

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
