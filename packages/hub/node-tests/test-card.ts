import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardId } from '../card';

export class TestCard {
  private parent: CardId | undefined;
  private model = {} as { [field: string]: any };

  localId?: string;
  originalRealm?: string;
  realm?: string;

  constructor(values: Fields) {
    this.localId = values.csLocalId;
    this.originalRealm = values.csOriginalRealm ?? values.csRealm;
    this.realm = values.csRealm;

    for (let [field, value] of Object.entries(values)) {
      if (!/^cs[A-Z]/.test(field)) {
        // a user field
        this.model[field] = value;
      }
    }
  }

  get jsonapi(): SingleResourceDoc {
    let doc = {
      data: {
        type: 'cards',
        attributes: {
          model: {
            attributes: this.model,
          },
        } as NonNullable<SingleResourceDoc['data']['attributes']>,
        relationships: {} as NonNullable<SingleResourceDoc['data']['relationships']>,
      },
    };
    if (this.localId) {
      doc.data.attributes['local-id'] = this.localId;
    }

    if (this.realm) {
      doc.data.attributes.realm = this.realm;
    }

    if (this.originalRealm) {
      doc.data.attributes['original-realm'] = this.originalRealm;
    }

    if (this.parent) {
      doc.data.relationships['adopts-from'] = {
        links: { related: '' },
      };
    }

    return doc;
  }

  adoptingFrom(parent: CardId) {
    this.parent = parent;
    return this;
  }
}

interface Fields {
  csRealm?: string;
  csOriginalRealm?: string;
  csLocalId?: string;
  [fieldName: string]: any;
}

export function testCard(values: Fields): TestCard {
  return new TestCard(values);
}
