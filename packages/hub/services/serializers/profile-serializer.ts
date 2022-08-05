import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import config from 'config';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { Profile } from '@prisma/client';

export default class ProfileSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  serialize(model: Profile): JSONAPIDocument;
  serialize(model: Profile[]): JSONAPIDocument;

  serialize(model: Profile | Profile[]): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => {
          return this.serialize(m).data;
        }),
      };
    } else {
      // FIXME what is to be done with this type?
      let did = encodeDID({ type: 'MerchantInfo', uniqueId: model.id });

      const result = {
        meta: {
          network: config.get('web3.layer2Network'),
        },
        data: {
          id: model.id,
          type: 'profiles',
          attributes: {
            did,
            name: model.name,
            slug: model.slug,
            color: model.color,
            'text-color': model.textColor,
            'owner-address': model.ownerAddress,
            links: model.links,
            'profile-description': model.profileDescription,
            'profile-image-url': model.profileImageUrl,
          },
        },
      };

      return result as JSONAPIDocument;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'profile-serializer': ProfileSerializer;
  }
}
