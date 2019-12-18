import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardId, canonicalURL } from '../card';
import { UpstreamDocument } from '../document';

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
      doc.data.attributes.localId = this.localId;
    }

    if (this.realm) {
      doc.data.attributes.realm = this.realm;
    }

    if (this.originalRealm) {
      doc.data.attributes.originalRealm = this.originalRealm;
    }

    if (this.parent) {
      doc.data.relationships.adoptsFrom = {
        links: { related: canonicalURL(this.parent) },
      };
    }

    return doc;
  }

  get upstreamDoc(): UpstreamDocument {
    return new UpstreamDocument(this.jsonapi);
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

interface TestCardWithId extends TestCard {
  localId: string;
  realm: string;
  originalRealm: string;
}

export function testCard(values: { csRealm: string; csLocalId: string; [userField: string]: any }): TestCardWithId;
export function testCard(values: Fields): TestCard;
export function testCard(values: Fields): TestCard | TestCardWithId {
  return new TestCard(values);
}
