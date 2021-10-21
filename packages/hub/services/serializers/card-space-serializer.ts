import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import { CardSpace } from '../../routes/card-spaces';
import config from 'config';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class CardSpaceSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(model: CardSpace): Promise<JSONAPIDocument> {
    let did = encodeDID({ type: 'CardSpace', uniqueId: model.id });

    const result = {
      meta: {
        network: config.get('web3.network'),
      },
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
          'bio-title': model.bioTitle,
          'bio-description': model.bioDescription,
          links: model.links,
          'donation-title': model.donationTitle,
          'donation-description': model.donationDescription,
          'donation-suggestion-amount-1': model.donationSuggestionAmount1,
          'donation-suggestion-amount-2': model.donationSuggestionAmount2,
          'donation-suggestion-amount-3': model.donationSuggestionAmount3,
          'donation-suggestion-amount-4': model.donationSuggestionAmount4,
          'merchant-id': model.merchantId,
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
