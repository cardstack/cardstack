import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardId, canonicalURL } from '../card';
import { UpstreamDocument } from '../document';
import { CARDSTACK_PUBLIC_REALM } from '../realm';

export class TestCard {
  private parent: CardId | undefined;
  private userFieldValues: Map<string, any> = new Map();
  private userFieldRefs: Map<string, CardId | undefined> = new Map();
  private fields: Map<string, TestCard | null> = new Map();

  csId?: string;
  csOriginalRealm?: string;
  csRealm?: string;

  withAttributes(values: FieldValues & { csId: string; csRealm: string }): TestCardWithId;
  withAttributes<T extends TestCard>(this: T, values: FieldValues): T;
  withAttributes(values: FieldValues): TestCard | TestCardWithId {
    for (let [field, value] of Object.entries(values)) {
      if (/^cs[A-Z]/.test(field)) {
        // cardstack fields
        switch (field) {
          case 'csId':
            this.csId = value;
            break;
          case 'csOriginalRealm':
            this.csOriginalRealm = value;
            break;
          case 'csRealm':
            this.csRealm = value;
            if (this.csOriginalRealm == null) {
              this.csOriginalRealm = value;
            }
            break;
          default:
            throw new Error(`unknown cardstack field ${field}`);
        }
      } else {
        // a user field
        this.userFieldValues.set(field, value);
        if (!this.fields.has(field)) {
          this.fields.set(field, new TestCard().adoptingFrom(this.guessValueType(value)));
        }
      }
    }
    return this;
  }

  withRelationships<T extends TestCard>(this: T, values: FieldRefs): T {
    for (let [field, value] of Object.entries(values)) {
      if (/^cs[A-Z]/.test(field)) {
        // cardstack fields
        switch (field) {
          case 'csAdoptsFrom':
            this.parent = value;
            break;
          default:
            throw new Error(`unknown cardstack field ${field}`);
        }
      } else {
        // a user field
        this.userFieldRefs.set(field, value);
        if (!this.fields.has(field)) {
          this.fields.set(field, new TestCard().adoptingFrom(this.guessReferenceType(value)));
        }
      }
    }
    return this;
  }

  withField<T extends TestCard>(this: T, name: string, fieldShorthand: string, values?: FieldValues): T;
  withField<T extends TestCard>(this: T, name: string, fieldCard: CardId, values?: FieldValues): T;
  withField<T extends TestCard>(this: T, name: string, fieldCard: null): T;
  withField(name: string, fieldCard: string | CardId | null, values: FieldValues = {}): this {
    if (fieldCard == null) {
      this.fields.set(name, null);
      return this;
    }

    if (typeof fieldCard === 'string') {
      fieldCard = { csRealm: CARDSTACK_PUBLIC_REALM, csId: fieldCard };
    }

    this.fields.set(name, new TestCard().withAttributes(values).adoptingFrom(fieldCard));
    return this;
  }

  get jsonapi(): SingleResourceDoc {
    let attributes = Object.create(null);
    for (let [key, value] of this.userFieldValues.entries()) {
      attributes[key] = value;
    }

    let relationships = Object.create(null);
    for (let [key, value] of this.userFieldRefs.entries()) {
      relationships[key] =
        value == null
          ? null
          : {
              links: {
                related: canonicalURL(value),
              },
            };
    }

    let doc = {
      data: {
        type: 'cards',
        attributes,
        relationships,
      },
    };
    if (this.csId) {
      doc.data.attributes.csId = this.csId;
    }

    if (this.csRealm) {
      doc.data.attributes.csRealm = this.csRealm;
    }

    if (this.csOriginalRealm) {
      doc.data.attributes.csOriginalRealm = this.csOriginalRealm;
    }

    if (this.parent) {
      doc.data.relationships.csAdoptsFrom = {
        links: { related: canonicalURL(this.parent) },
      };
    }

    let csFields = Object.create(null);
    for (let [fieldName, testCard] of this.fields) {
      if (testCard) {
        csFields[fieldName] = testCard.jsonapi;
      }
    }
    doc.data.attributes.csFields = csFields;

    return doc;
  }

  get upstreamDoc(): UpstreamDocument {
    return new UpstreamDocument(this.jsonapi);
  }

  adoptingFrom<T extends TestCard>(this: T, parent: CardId): T {
    this.parent = parent;
    return this;
  }

  private guessValueType(_value: any): CardId {
    return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'string-field' };
  }

  private guessReferenceType(value: CardId | TestCardWithId | undefined): CardId {
    if (value instanceof TestCard && value.parent) {
      return value.parent;
    }
    return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base-card' };
  }
}

interface FieldValues {
  csRealm?: string;
  csOriginalRealm?: string;
  csId?: string;
  [fieldName: string]: any;
}

interface FieldRefs {
  csAdoptsFrom?: CardId;
  [fieldName: string]: CardId | TestCardWithId | undefined;
}

interface TestCardWithId extends TestCard {
  csId: string;
  csRealm: string;
  csOriginalRealm: string;
}

export function testCard(): TestCard {
  return new TestCard();
}
