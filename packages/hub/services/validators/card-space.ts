import { CardSpace } from '../../routes/card-spaces';
import CardSpaceQueries from '../queries/card-space';
import { inject } from '../../di/dependency-injection';
import { URL } from 'url';

export type CardSpaceAttribute = 'url' | 'profileName' | 'profileDescription' | 'profileButtonText' | 'profileCategory';
export type CardSpaceErrors = Record<CardSpaceAttribute, string[]>;

const MAX_LONG_FIELD_LENGTH = 300;
const MAX_SHORT_FIELD_LENGTH = 50;
const ALLOWED_BUTTON_TEXTS = ['Visit this Space', 'Visit this Business', 'Visit this Creator', 'Visit this Person'];

export default class CardSpaceValidator {
  cardSpaceQueries: CardSpaceQueries = inject('card-space-queries', {
    as: 'cardSpaceQueries',
  });

  async validate(cardSpace: CardSpace): Promise<CardSpaceErrors> {
    let errors: CardSpaceErrors = {
      url: [],
      profileName: [],
      profileDescription: [],
      profileButtonText: [],
      profileCategory: [],
    };

    let attributes: CardSpaceAttribute[] = [
      'url',
      'profileName',
      'profileDescription',
      'profileButtonText',
      'profileCategory',
    ];

    attributes.forEach((attribute) => {
      if (!cardSpace[attribute]) {
        errors[attribute].push('Must be present');
      }
    });

    if (!ALLOWED_BUTTON_TEXTS.includes(cardSpace.profileButtonText)) {
      errors.profileButtonText.push(`Needs to be one of the ${ALLOWED_BUTTON_TEXTS}`);
    }

    if (cardSpace.profileDescription?.length > MAX_LONG_FIELD_LENGTH) {
      errors.profileDescription.push(`Max length is ${MAX_LONG_FIELD_LENGTH}`);
    }

    if (cardSpace.profileName?.length > MAX_SHORT_FIELD_LENGTH) {
      errors.profileName.push(`Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    if (cardSpace.profileCategory?.length > MAX_SHORT_FIELD_LENGTH) {
      errors.profileCategory.push(`Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    try {
      let urlObject = new URL(`https://${cardSpace.url}`);
      if (!urlObject.hostname.endsWith('card.space')) {
        errors.url.push('Only card.space subdomains are allowed');
      }
    } catch (error) {
      errors.url.push('Invalid URL');
    }

    if (cardSpace.url.split('.').length - 1 !== 2) {
      errors.url.push('Only first level subdomains are allowed');
    }

    let cardSpaceWithExistingUrl = (await this.cardSpaceQueries.query({ url: cardSpace.url }))[0];

    if (cardSpaceWithExistingUrl) {
      errors.url.push('Already exists');
    }

    return errors;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-space-validator': CardSpaceValidator;
  }
}
