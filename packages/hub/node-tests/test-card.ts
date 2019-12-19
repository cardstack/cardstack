import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardId, canonicalURL } from '../card';
import { UpstreamDocument } from '../document';
import { CARDSTACK_PUBLIC_REALM } from '../realm';

export class TestCard {
  private parent: CardId | undefined;
  private userFieldValues: Map<string, any> = new Map();
  private fields: Map<string, TestCard> = new Map();

  localId?: string;
  originalRealm?: string;
  realm?: string;

  constructor(values: FieldValues = {}) {
    this.localId = values.csLocalId;
    this.originalRealm = values.csOriginalRealm ?? values.csRealm;
    this.realm = values.csRealm;

    for (let [field, value] of Object.entries(values)) {
      if (!/^cs[A-Z]/.test(field)) {
        // a user field
        this.userFieldValues.set(field, value);
        this.fields.set(field, new TestCard().adoptingFrom(guessType(value)));
      }
    }
  }

  withField(name: string, fieldShorthand: string, values?: FieldValues): this;
  withField(name: string, fieldCard: CardId, values?: FieldValues): this;
  withField(name: string, fieldCard: null): this;
  withField(name: string, fieldCard: string | CardId | null, values: FieldValues = {}): this {
    if (fieldCard == null) {
      this.fields.delete(name);
      return this;
    }

    if (typeof fieldCard === 'string') {
      fieldCard = { realm: CARDSTACK_PUBLIC_REALM, localId: fieldCard };
    }

    this.fields.set(name, new TestCard(values).adoptingFrom(fieldCard));
    return this;
  }

  get jsonapi(): SingleResourceDoc {
    let attributes = Object.create(null);

    for (let [key, value] of this.userFieldValues.entries()) {
      attributes[key] = value;
    }

    let doc = {
      data: {
        type: 'cards',
        attributes,
        relationships: {} as NonNullable<SingleResourceDoc['data']['relationships']>,
      },
    };
    if (this.localId) {
      doc.data.attributes.csLocalId = this.localId;
    }

    if (this.realm) {
      doc.data.attributes.csRealm = this.realm;
    }

    if (this.originalRealm) {
      doc.data.attributes.csOriginalRealm = this.originalRealm;
    }

    if (this.parent) {
      doc.data.relationships.csAdoptsFrom = {
        links: { related: canonicalURL(this.parent) },
      };
    }

    let csFields = Object.create(null);
    for (let [fieldName, testCard] of this.fields) {
      csFields[fieldName] = testCard.jsonapi;
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

interface FieldValues {
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

function guessType(_value: any) {
  return { realm: CARDSTACK_PUBLIC_REALM, localId: 'string-field' };
}

export function testCard(values: FieldValues & { csLocalId: string; csRealm: string }): TestCardWithId;
export function testCard(values?: FieldValues): TestCard;
export function testCard(values: FieldValues = {}): TestCard | TestCardWithId {
  return new TestCard(values);
}
