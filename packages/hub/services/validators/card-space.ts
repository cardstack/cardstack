import { CardSpace } from '../../routes/card-spaces';
import { URL } from 'url';
import { NestedAttributeError, RelationshipError } from '../../routes/utils/error';
import { query } from '@cardstack/hub/queries';

export type CardSpaceAttribute = 'profileDescription' | 'profileImageUrl' | 'links';

export type CardSpaceRelationship = 'merchantInfo';

export type CardSpaceErrors = Record<
  CardSpaceAttribute | CardSpaceRelationship,
  (string | NestedAttributeError | RelationshipError)[]
>;

const MAX_LONG_FIELD_LENGTH = 300;
const MAX_SHORT_FIELD_LENGTH = 50;

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

export default class CardSpaceValidator {
  cardSpaceQueries = query('card-space', { as: 'cardSpaceQueries' });

  async validate(cardSpace: CardSpace): Promise<CardSpaceErrors> {
    let errors: CardSpaceErrors = {
      merchantInfo: [],
      profileDescription: [],
      links: [],
      profileImageUrl: [],
    };

    if (cardSpace.profileDescription && cardSpace.profileDescription.length > MAX_LONG_FIELD_LENGTH) {
      errors.profileDescription.push(`Max length is ${MAX_LONG_FIELD_LENGTH}`);
    }

    if (cardSpace.profileImageUrl && !isValidUrl(cardSpace.profileImageUrl!)) {
      errors.profileImageUrl.push('Invalid URL');
    }

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
        } else if (!isValidUrl(url!)) {
          errors.links.push({
            index,
            attribute: 'url',
            detail: 'Invalid URL',
          });
        }
      });
    }

    return errors;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-space-validator': CardSpaceValidator;
  }
}
