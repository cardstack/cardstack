import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '../../di/dependency-injection';
import DatabaseManager from '../database-manager';
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
          name: model.name,
          url: model.url,
          description: model.description,
          category: model.category,
          'profile-image-url': model.profileImageUrl,
          'cover-image-url': model.coverImageUrl,
          'button-text': model.buttonText,
          'owner-address': model.ownerAddress,
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-space-serializer': CardSpaceSerializer;
  }
}
