import { CardSpace } from '../../routes/card-spaces';
import CardSpaceQueries from '../queries/card-space';
import { inject } from '../../di/dependency-injection';

export interface CardSpaceErrors {
  name?: string;
  url?: string;
  description?: string;
  buttonText?: string;
  category?: string;
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

    ['name', 'url', 'description', 'buttonText', 'category'].forEach((attribute) => {
      if (!cardSpace[attribute as keyof CardSpaceErrors]) {
        errors[attribute as keyof CardSpaceErrors] = 'Must be present';
      }
    });

    if (!ALLOWED_BUTTON_TEXTS.includes(cardSpace.buttonText)) {
      errors['buttonText'] = `Needs to be one of the ${ALLOWED_BUTTON_TEXTS}`;
    }

    if (cardSpace.description?.length > MAX_LONG_FIELD_LENGTH) {
      errors['description'] = `Max length is ${MAX_LONG_FIELD_LENGTH}`;
    }

    if (cardSpace.name?.length > MAX_SHORT_FIELD_LENGTH) {
      errors['name'] = `Max length is ${MAX_SHORT_FIELD_LENGTH}`;
    }

    if (cardSpace.category?.length > MAX_SHORT_FIELD_LENGTH) {
      errors['category'] = `Max length is ${MAX_SHORT_FIELD_LENGTH}`;
    }

    let cardSpaceWithExistingUrl = (await this.cardSpaceQueries.query({ url: cardSpace.url }))[0];

    if (cardSpaceWithExistingUrl) {
      errors['url'] = 'Already exists';
    }

    // TODO:
    // 1. URL validation for url
    // 2. URL validation for profileImageUrl, coverImageUrl
    // 3. validate name (prevent non alphanumeric characters?)

    return errors;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-space-validator': CardSpaceValidator;
  }
}
