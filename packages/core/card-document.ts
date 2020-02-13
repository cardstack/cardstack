import {
  SingleResourceDoc,
  AttributesObject,
  RelationshipObject,
  ResourceIdentifierObject,
  MetaObject,
} from 'jsonapi-typescript';
import { CardId, canonicalURL, cardstackFieldPattern, FieldArity, canonicalURLToCardId } from './card-id';
import { UpstreamDocument } from './document';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import cloneDeep from 'lodash/cloneDeep';

export class CardDocument {
  private parent: CardId | undefined;
  private csFieldValues: Map<string, any> = new Map();
  private userFieldValues: Map<string, any> = new Map();
  private userFieldRefs: Map<string, CardDocument | CardDocument[] | CardId | CardId[] | undefined> = new Map();
  private fields: Map<string, CardDocument | null> = new Map();
  private meta: MetaObject | undefined;

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
          case 'csTitle':
          case 'csDescription':
          case 'csFeatures':
          case 'csFiles':
          case 'csFieldArity':
          case 'csPeerDependencies':
          case 'csFieldSets':
            this.csFieldValues.set(field, value);
            break;
          case 'csFields':
            for (let [fieldName, fieldCardValue] of Object.entries(value || {})) {
              if (typeof fieldCardValue !== 'object') {
                continue;
              }
              this.withField(fieldName, cardDocumentFromJsonAPI({ data: { type: 'cards', ...fieldCardValue } }));
            }
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

  withMeta(meta: MetaObject): CardDocument | CardDocumentWithId {
    this.meta = meta;
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

  withoutField<T extends CardDocument>(this: T, name: string): T {
    this.fields.delete(name);
    return this;
  }

  withField<T extends CardDocument>(
    this: T,
    name: string,
    fieldShorthand: string,
    arity?: FieldArity,
    values?: FieldValues
  ): T;
  withField<T extends CardDocument>(
    this: T,
    name: string,
    fieldCardId: CardId,
    arity?: FieldArity,
    values?: FieldValues
  ): T;
  withField<T extends CardDocument>(
    this: T,
    name: string,
    fieldCard: CardDocument,
    arity?: FieldArity,
    values?: FieldValues
  ): T;
  withField<T extends CardDocument>(this: T, name: string, fieldCardId: null): T;
  withField(
    name: string,
    fieldCardOrId: string | CardId | CardDocument | null,
    arity: FieldArity = 'singular',
    values: FieldValues = {}
  ): this {
    if (fieldCardOrId == null) {
      this.fields.set(name, null);
      return this;
    }

    if (typeof fieldCardOrId === 'string') {
      fieldCardOrId = { csRealm: CARDSTACK_PUBLIC_REALM, csId: fieldCardOrId };
    }

    if (fieldCardOrId instanceof CardDocument) {
      arity = (fieldCardOrId.asCardValue.attributes?.csFieldArity as FieldArity) || arity;
      this.fields.set(name, fieldCardOrId.withAutoAttributes(values).withAttributes({ csFieldArity: arity }));
    } else {
      this.fields.set(
        name,
        new CardDocument()
          .withAutoAttributes(values)
          .withAttributes({ csFieldArity: arity })
          .adoptingFrom(fieldCardOrId)
      );
    }

    return this;
  }

  get jsonapiWithoutMeta(): SingleResourceDoc {
    let jsonapi = this.jsonapi;
    delete jsonapi.data.meta;
    return jsonapi;
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

    if (this.csOriginalRealm && this.csOriginalRealm !== this.csRealm) {
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

    let csFields = Object.create(null);
    for (let [fieldName, testCard] of this.fields) {
      if (testCard) {
        csFields[fieldName] = testCard.asCardValue;
      }
    }
    doc.data.attributes!.csFields = csFields;

    if (this.meta) {
      doc.data.meta = cloneDeep(this.meta);
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
    return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' };
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

export function cardDocumentFromJsonAPI(sourceDoc: SingleResourceDoc): CardDocument {
  let { relationships = {}, attributes = {}, meta } = sourceDoc.data;
  let fields = attributes.csFields;
  delete attributes.csFields;
  let fieldRefs: FieldRefs = {};
  for (let [field, ref] of Object.entries(relationships)) {
    if (!('data' in ref)) {
      continue;
    }
    if (Array.isArray(ref.data)) {
      fieldRefs[field] = (ref.data as ResourceIdentifierObject[]).map(i => canonicalURLToCardId(i.id));
    } else if (ref.data) {
      fieldRefs[field] = canonicalURLToCardId(ref.data.id);
    }
  }

  let doc = new CardDocument();
  if (meta) {
    doc.withMeta(meta);
  }
  if (fields) {
    for (let [name, value] of Object.entries(fields)) {
      let arity = value.attributes?.csFieldArity || 'singular';
      let fieldCardId = canonicalURLToCardId(value.relationships?.csAdoptsFrom?.data?.id) || {
        csRealm: CARDSTACK_PUBLIC_REALM,
        csId: 'base',
      };
      doc.withField(name, fieldCardId, arity, value.attributes);
    }
  }
  doc.withAttributes(attributes).withRelationships(fieldRefs);

  return doc;
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
