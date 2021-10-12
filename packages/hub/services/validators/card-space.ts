import { CardSpace } from '../../routes/card-spaces';
import CardSpaceQueries from '../queries/card-space';
import { inject } from '../../di/dependency-injection';
import { URL } from 'url';

export interface CardSpaceErrors {
  name: string[];
  url: string[];
  description: string[];
  buttonText: string[];
  category: string[];
}

const MAX_LONG_FIELD_LENGTH = 300;
const MAX_SHORT_FIELD_LENGTH = 50;
const ALLOWED_BUTTON_TEXTS = ['Visit this Space', 'Visit this Business', 'Visit this Creator', 'Visit this Person'];

export default class CardSpaceValidator {
  cardSpaceQueries: CardSpaceQueries = inject('card-space-queries', {
    as: 'cardSpaceQueries',
  });

  async validate(cardSpace: CardSpace): Promise<CardSpaceErrors> {
    let errors = {} as CardSpaceErrors;

    let addToErrors = (errors: any, attribute: string, message: string) => {
      if (!errors[attribute]) {
        errors[attribute] = [];
      }

      errors[attribute].push(message);
    };

    ['name', 'url', 'description', 'buttonText', 'category'].forEach((attribute) => {
      if (!cardSpace[attribute as keyof CardSpaceErrors]) {
        addToErrors(errors, attribute, 'Must be present');
      }
    });

    if (!ALLOWED_BUTTON_TEXTS.includes(cardSpace.buttonText)) {
      addToErrors(errors, 'buttonText', `Needs to be one of the ${ALLOWED_BUTTON_TEXTS}`);
    }

    if (cardSpace.description?.length > MAX_LONG_FIELD_LENGTH) {
      addToErrors(errors, 'description', `Max length is ${MAX_LONG_FIELD_LENGTH}`);
    }

    if (cardSpace.name?.length > MAX_SHORT_FIELD_LENGTH) {
      addToErrors(errors, 'name', `Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    if (cardSpace.category?.length > MAX_SHORT_FIELD_LENGTH) {
      addToErrors(errors, 'category', `Max length is ${MAX_SHORT_FIELD_LENGTH}`);
    }

    try {
      let urlObject = new URL(`https://${cardSpace.url}`);
      if (!urlObject.hostname.endsWith('card.space')) {
        addToErrors(errors, 'url', 'Only card.space subdomains are allowed');
      }
    } catch (error) {
      addToErrors(errors, 'url', `Invalid URL`);
    }

    if (cardSpace.url.split('.').length - 1 !== 2) {
      addToErrors(errors, 'url', `Only first level subdomains are allowed`);
    }

    let cardSpaceWithExistingUrl = (await this.cardSpaceQueries.query({ url: cardSpace.url }))[0];

    if (cardSpaceWithExistingUrl) {
      addToErrors(errors, 'url', `Already exists`);
    }

    return errors;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-space-validator': CardSpaceValidator;
  }
}
