import { CardSpace } from '../../routes/card-spaces';
import CardSpaceQueries from '../queries/card-space';
import { inject } from '@cardstack/di';
import { URL } from 'url';

export type CardSpaceAttribute =
  | 'url'
  | 'profileName'
  | 'profileDescription'
  | 'profileButtonText'
  | 'profileImageUrl'
  | 'profileCoverImageUrl'
  | 'profileCategory'
  | 'bioTitle'
  | 'bioDescription'
  | 'donationTitle'
  | 'donationDescription'
  | 'links'
  | 'donationSuggestionAmount1'
  | 'donationSuggestionAmount2'
  | 'donationSuggestionAmount3'
  | 'donationSuggestionAmount4';

export interface NestedAttributeError {
  index: number;
  attribute: string;
  detail: string;
}
export type CardSpaceErrors = Record<CardSpaceAttribute, (string | NestedAttributeError)[]>;
type UrlValidationResult = Record<'valid', boolean>;

const MAX_LONG_FIELD_LENGTH = 300;
const MAX_SHORT_FIELD_LENGTH = 50;
const ALLOWED_BUTTON_TEXTS = ['Visit this Space', 'Visit this Business', 'Visit this Creator', 'Visit this Person'];

function validateUrl(url: string): UrlValidationResult {
  try {
    new URL(url);
  } catch (_) {
    return {
      valid: false,
    };
  }

  return {
    valid: true,
  };
}

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
      bioTitle: [],
      bioDescription: [],
      donationTitle: [],
      donationDescription: [],
      links: [],
      profileImageUrl: [],
      profileCoverImageUrl: [],
      donationSuggestionAmount1: [],
      donationSuggestionAmount2: [],
      donationSuggestionAmount3: [],
      donationSuggestionAmount4: [],
    };

    let mandatoryAttributes: CardSpaceAttribute[] = [
      'url',
      'profileName',
      'profileDescription',
      'profileButtonText',
      'profileCategory',
    ];

    mandatoryAttributes.forEach((attribute) => {
      if (!cardSpace[attribute]) {
        errors[attribute].push('Must be present');
      }
    });

    if (!ALLOWED_BUTTON_TEXTS.includes(cardSpace.profileButtonText!)) {
      errors.profileButtonText.push(`Needs to be one of the: ${ALLOWED_BUTTON_TEXTS.join(', ')}`);
    }

    if (cardSpace.profileDescription && cardSpace.profileDescription.length > MAX_LONG_FIELD_LENGTH) {
      errors.profileDescription.push(`Max length is ${MAX_LONG_FIELD_LENGTH}`);
    }

    if (cardSpace.profileName && cardSpace.profileName.length > MAX_SHORT_FIELD_LENGTH) {
      errors.profileName.push(`Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    if (cardSpace.profileCategory && cardSpace.profileCategory.length > MAX_SHORT_FIELD_LENGTH) {
      errors.profileCategory.push(`Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    // Validate URLs

    let cardSpaceUrl = `https://${cardSpace.url}`;
    let urlValid = validateUrl(cardSpaceUrl!).valid;

    if (!urlValid) {
      errors.url.push('Invalid URL');
    } else {
      let urlObject = new URL(cardSpaceUrl);
      if (!urlObject.hostname.endsWith('card.space')) {
        errors.url.push('Only card.space subdomains are allowed');
      }
    }

    if (cardSpace.url && cardSpace.url.split('.').length - 1 !== 2) {
      errors.url.push('Only first level subdomains are allowed');
    }

    let cardSpaceWithExistingUrl = (await this.cardSpaceQueries.query({ url: cardSpace.url }))[0];

    if (cardSpace.id !== cardSpaceWithExistingUrl?.id && cardSpaceWithExistingUrl) {
      errors.url.push('Already exists');
    }

    if (!validateUrl(cardSpace.profileImageUrl!).valid) {
      errors.profileImageUrl.push('Invalid URL');
    }

    if (!validateUrl(cardSpace.profileCoverImageUrl!).valid) {
      errors.profileCoverImageUrl.push('Invalid URL');
    }

    // Validate text fields

    if (cardSpace.bioTitle && cardSpace.bioTitle.length > MAX_SHORT_FIELD_LENGTH) {
      errors.bioTitle.push(`Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    if (cardSpace.bioDescription && cardSpace.bioDescription.length > MAX_LONG_FIELD_LENGTH) {
      errors.bioDescription.push(`Max length is ${MAX_LONG_FIELD_LENGTH}`);
    }

    if (cardSpace.donationTitle && cardSpace.donationTitle.length > MAX_SHORT_FIELD_LENGTH) {
      errors.donationTitle.push(`Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    if (cardSpace.donationDescription && cardSpace.donationDescription.length > MAX_LONG_FIELD_LENGTH) {
      errors.donationDescription.push(`Max length is ${MAX_LONG_FIELD_LENGTH}`);
    }

    // Validate links

    if (cardSpace.links) {
      cardSpace.links.forEach((linkItem, index) => {
        let { title, url } = linkItem;

        if (!title) {
          errors.links.push({
            index,
            attribute: 'title',
            detail: 'Must be present',
          });
        } else if (title.length > MAX_SHORT_FIELD_LENGTH) {
          errors.links.push({
            index,
            attribute: 'title',
            detail: `Max length is ${MAX_SHORT_FIELD_LENGTH}`,
          });
        }

        if (!url) {
          errors.links.push({
            index,
            attribute: 'url',
            detail: 'Must be present',
          });
        } else if (!validateUrl(url!).valid) {
          errors.links.push({
            index,
            attribute: 'url',
            detail: 'Invalid URL',
          });
        }
      });
    }

    let donationAttributes: CardSpaceAttribute[] = [
      'donationSuggestionAmount1',
      'donationSuggestionAmount2',
      'donationSuggestionAmount3',
      'donationSuggestionAmount4',
    ];

    donationAttributes.forEach((attribute) => {
      if (cardSpace[attribute] && !Number.isInteger(cardSpace[attribute])) {
        errors[attribute].push('Must be an integer');
      }
    });

    return errors;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-space-validator': CardSpaceValidator;
  }
}
