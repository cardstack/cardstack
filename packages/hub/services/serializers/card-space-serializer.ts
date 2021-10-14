import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import { CardSpace } from '../../routes/card-spaces';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class CardSpaceSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(model: CardSpace): Promise<JSONAPIDocument> {
    let did = encodeDID({ type: 'CardSpace', uniqueId: model.id });

    const result = {
      data: {
        id: model.id,
        type: 'card-spaces',
        attributes: {
          did,
          url: model.url,
          'profile-name': model.profileName,
          'profile-description': model.profileDescription,
          'profile-category': model.profileCategory,
          'profile-image-url': model.profileImageUrl,
          'profile-cover-image-url': model.profileCoverImageUrl,
          'profile-button-text': model.profileButtonText,
          'owner-address': model.ownerAddress,
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
