import { SingleResourceDoc, AttributesObject, RelationshipObject } from 'jsonapi-typescript';
import { CardId, canonicalURL, cardstackFieldPattern, FieldCard } from './card';
import { UpstreamDocument } from './document';
import { CARDSTACK_PUBLIC_REALM } from './realm';

export class CardDocument {
  private parent: CardId | undefined;
  private csFieldValues: Map<string, any> = new Map();
  private userFieldValues: Map<string, any> = new Map();
  private userFieldRefs: Map<string, CardDocument | CardDocument[] | CardId | CardId[] | undefined> = new Map();
  private fields: Map<string, CardDocument | null> = new Map();

  csId?: string;
  csOriginalRealm?: string;
  csRealm?: string;

  private setAttributes(values: FieldValues, autoCreateField: boolean) {
    for (let [field, value] of Object.entries(values)) {
      if (cardstackFieldPattern.test(field)) {
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
          case 'csFeatures':
          case 'csFiles':
          case 'csFieldArity':
          case 'csPeerDependencies':
          case 'csFieldSets':
            this.csFieldValues.set(field, value);
            break;
          default:
            throw new Error(`unknown cardstack field ${field}`);
        }
      } else {
        // a user field
        this.userFieldValues.set(field, value);
        if (!this.fields.has(field) && autoCreateField) {
          this.fields.set(field, new CardDocument().adoptingFrom(this.guessValueType(value)));
        }
      }
    }
  }

  withAttributes(values: FieldValues & { csId: string; csRealm: string }): CardDocumentWithId;
  withAttributes<T extends CardDocument>(this: T, values: FieldValues): T;
  withAttributes(values: FieldValues): CardDocument | CardDocumentWithId {
    this.setAttributes(values, false);
    return this;
  }

  withAutoAttributes(values: FieldValues & { csId: string; csRealm: string }): CardDocumentWithId;
  withAutoAttributes<T extends CardDocument>(this: T, values: FieldValues): T;
  withAutoAttributes(values: FieldValues): CardDocument | CardDocumentWithId {
    this.setAttributes(values, true);
    return this;
  }

  private setRelationships(values: FieldRefs, autoCreateField: boolean) {
    for (let [field, value] of Object.entries(values)) {
      if (/^cs[A-Z]/.test(field)) {
        // cardstack fields
        switch (field) {
          case 'csAdoptsFrom':
            if (!Array.isArray(value)) {
              this.parent = value;
            }
            break;
          default:
            throw new Error(`unknown cardstack field ${field}`);
        }
      } else {
        // a user field
        this.userFieldRefs.set(field, value);
        if (!this.fields.has(field) && autoCreateField) {
          this.fields.set(
            field,
            new CardDocument().adoptingFrom(
              this.guessReferenceType(!Array.isArray(value) ? value : value.length ? value[0] : undefined)
            )
          );
        }
      }
    }
  }

  withRelationships<T extends CardDocument>(this: T, values: FieldRefs): T {
    this.setRelationships(values, false);
    return this;
  }

  withAutoRelationships<T extends CardDocument>(this: T, values: FieldRefs): T {
    this.setRelationships(values, true);
    return this;
  }

  withField<T extends CardDocument>(
    this: T,
    name: string,
    fieldShorthand: string,
    arity?: FieldCard['csFieldArity'],
    values?: FieldValues
  ): T;
  withField<T extends CardDocument>(
    this: T,
    name: string,
    fieldCard: CardId,
    arity?: FieldCard['csFieldArity'],
    values?: FieldValues
  ): T;
  withField<T extends CardDocument>(this: T, name: string, fieldCard: null): T;
  withField(
    name: string,
    fieldCard: string | CardId | null,
    arity: FieldCard['csFieldArity'] = 'singular',
    values: FieldValues = {}
  ): this {
    if (fieldCard == null) {
      this.fields.set(name, null);
      return this;
    }

    if (typeof fieldCard === 'string') {
      fieldCard = { csRealm: CARDSTACK_PUBLIC_REALM, csId: fieldCard };
    }

    this.fields.set(
      name,
      new CardDocument()
        .withAutoAttributes(values)
        .withAttributes({ csFieldArity: arity })
        .adoptingFrom(fieldCard)
    );
    return this;
  }

  get jsonapi(): SingleResourceDoc {
    let attributes = Object.create(null);
    for (let [key, value] of this.userFieldValues.entries()) {
      attributes[key] = value;
    }
    for (let [key, value] of this.csFieldValues.entries()) {
      attributes[key] = value;
    }

    let relationships = Object.create(null);
    for (let [key, value] of this.userFieldRefs.entries()) {
      if (Array.isArray(value)) {
        relationships[key] = {
          data: (value as any[]).map((i: CardId | CardDocument) => ({ type: 'cards', id: getRelatedCanonicalURL(i) })),
        };
      } else if (value != null) {
        let id = getRelatedCanonicalURL(value);
        relationships[key] = {
          data: value == null ? null : { type: 'cards', id },
        };
      }
    }

    let doc: SingleResourceDoc = {
      data: {
        type: 'cards',
        attributes,
        relationships,
      },
    };
    if (this.csId) {
      doc.data.attributes!.csId = this.csId;
    }

    if (this.csRealm) {
      doc.data.attributes!.csRealm = this.csRealm;
    }

    if (this.csOriginalRealm) {
      doc.data.attributes!.csOriginalRealm = this.csOriginalRealm;
    }

    if (this.csId != null && this.csRealm != null) {
      let { csRealm, csOriginalRealm, csId } = this;
      doc.data.id = canonicalURL({ csRealm, csOriginalRealm, csId });
    }

    if (this.parent) {
      doc.data.relationships!.csAdoptsFrom = {
        data: { type: 'cards', id: canonicalURL(this.parent) },
      };
    }

    if (this.fields.size) {
      let csFields = Object.create(null);
      for (let [fieldName, testCard] of this.fields) {
        if (testCard) {
          csFields[fieldName] = testCard.asCardValue;
        }
      }
      doc.data.attributes!.csFields = csFields;
    }

    return doc;
  }

  get canonicalURL(): string | undefined {
    if (this.csId && this.csRealm) {
      return canonicalURL({ csId: this.csId, csRealm: this.csRealm, csOriginalRealm: this.csOriginalRealm });
    }
    return undefined;
  }

  get asCardValue(): {
    id?: string;
    attributes?: AttributesObject;
    relationships?: { [field: string]: RelationshipObject };
  } {
    let cardValue: this['asCardValue'] = {};
    let { attributes, relationships, id } = this.jsonapi.data;
    if (id != null) {
      cardValue.id = id;
    }
    if (attributes) {
      cardValue.attributes = attributes;
    }
    if (relationships) {
      cardValue.relationships = relationships;
    }
    return cardValue;
  }

  get upstreamDoc(): UpstreamDocument {
    return new UpstreamDocument(this.jsonapi);
  }

  adoptingFrom<T extends CardDocument>(this: T, parent: CardId): T {
    this.parent = parent;
    return this;
  }

  private guessValueType(value: any): CardId {
    switch (typeof value) {
      case 'boolean':
        return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'boolean-field' };
      case 'string':
      default:
        return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'string-field' };
    }
  }

  private guessReferenceType(value: CardId | CardDocumentWithId | undefined): CardId {
    if (value instanceof CardDocument && value.parent) {
      return value.parent;
    }
    return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base-card' };
  }
}

export interface CardDocumentWithId extends CardDocument {
  csId: string;
  csRealm: string;
  csOriginalRealm: string;
}

interface FieldValues {
  csRealm?: string;
  csOriginalRealm?: string;
  csId?: string;
  [fieldName: string]: any;
}

interface FieldRefs {
  csAdoptsFrom?: CardId;
  [fieldName: string]: CardId | CardDocumentWithId | CardId[] | CardDocumentWithId[] | undefined;
}

export function cardDocument(): CardDocument {
  return new CardDocument();
}

function getRelatedCanonicalURL(idOrDoc: CardDocument | CardId): string {
  if (idOrDoc instanceof CardDocument) {
    if (idOrDoc.csId == null || idOrDoc.csRealm == null) {
      throw new Error(`Cannot create relationship in card document because related CardDocument is not addressable`);
    }
    return canonicalURL(idOrDoc as CardId);
  } else if (idOrDoc) {
    return canonicalURL(idOrDoc);
  }
  throw new Error(`Cannot create relationship in card document because there is no related card id`);
}
