import CardstackError from './error';
import { loadFeature } from './scaffolding';
import { WriterFactory } from './writer';
import { PristineDocument, UpstreamDocument, UpstreamIdentity, PristineCollection } from './document';
import { SingleResourceDoc, RelationshipObject } from 'jsonapi-typescript';
import cloneDeep from 'lodash/cloneDeep';
import isPlainObject from 'lodash/isPlainObject';
import mergeWith from 'lodash/mergeWith';
import { ResponseMeta } from './pgsearch/pgclient';
import * as J from 'json-typescript';
import { IndexerFactory } from './indexer';
import { ScopedCardService } from './cards-service';
import * as FieldHooks from './field-hooks';
import { inject, getOwner } from './dependency-injection';

export const apiPrefix = '/api';

export function canonicalURLToCardId(url: string): CardId {
  let parts = url.split('/');
  let csId = parts.pop()!;
  let nextPart = parts.pop()!;
  let originalRealm;
  if (nextPart !== 'cards') {
    originalRealm = nextPart;
    parts.pop();
  }
  return {
    csRealm: parts.join('/'),
    csOriginalRealm: originalRealm == null ? undefined : decodeURIComponent(originalRealm),
    csId: decodeURIComponent(csId),
  };
}

export function canonicalURL(id: CardId): string {
  let isHome = !id.csOriginalRealm || id.csOriginalRealm === id.csRealm;
  if (isHome) {
    return [id.csRealm, 'cards', encodeURIComponent(id.csId)].join('/');
  } else {
    return [
      id.csRealm,
      'cards',
      encodeURIComponent(id.csOriginalRealm ?? id.csRealm),
      encodeURIComponent(id.csId),
    ].join('/');
  }
}

export const cardstackFieldPattern = /^cs[A-Z]/;

export async function makePristineCollection(
  cards: AddressableCard[],
  meta: ResponseMeta
): Promise<PristineCollection> {
  let pristineDocs = await Promise.all(cards.map(card => card.asPristineDoc()));
  // TODO includeds
  return new PristineCollection({
    data: pristineDocs.map(doc => doc.jsonapi.data),
    meta: (meta as unknown) as J.Object,
  });
}

export class Card {
  modules = inject('modules');

  // This is the realm the card is stored in.
  csRealm: string;

  // this is the realm the card was first created in. As a card is copied to
  // other realms, `card.csRealm` changes but `card.csOriginalRealm` does not.
  csOriginalRealm: string;

  // the csId distinguishes the card within its originalRealm. In some cases
  // it may be chosen by the person creating the card. In others it may be
  // chosen by the hub.
  csId: string | undefined;

  // if this card is stored inside another, this is the other
  readonly enclosingCard: Card | undefined;

  protected jsonapi: SingleResourceDoc;
  private ownFields: Map<string, FieldCard> = new Map();

  // Identity invariants:
  //
  //  - within a given csOriginalRealm, csId is unique.
  //
  //  - [csOriginalRealm, csId] is the globally unique *semantic* identity of a
  //    card. In other words, two Cards with the same [csOriginalRealm, csId]
  //    are "the same card" from the user's perspective, but might be different
  //    "versions" of it, stored in different realms.
  //
  //  - within a given realm, [csOriginalRealm, csId] is unique. That is, we
  //    only allow one version of the same card per realm.
  //
  //  - [csRealm, csOriginalRealm, csId] is globally unique, such that there are
  //    exactly zero or one cards that match it, across all hubs.

  constructor(
    jsonapi: SingleResourceDoc,
    realm: string,
    enclosingCard: Card | undefined,
    protected service: ScopedCardService
  ) {
    this.jsonapi = jsonapi;
    this.csRealm = realm;
    this.enclosingCard = enclosingCard;
    this.csOriginalRealm =
      typeof jsonapi.data.attributes?.csOriginalRealm === 'string' ? jsonapi.data.attributes.csOriginalRealm : realm;

    if (typeof jsonapi.data.attributes?.csId === 'string') {
      this.csId = jsonapi.data.attributes?.csId;
    }

    let fields = jsonapi.data.attributes?.csFields;
    if (fields) {
      if (!isPlainObject(fields)) {
        throw new CardstackError(`csFields must be an object`);
      }
      for (let [name, value] of Object.entries(fields)) {
        this.ownFields.set(name, new FieldCard(value, name, this, this.service));
      }
    }
  }

  async clone(): Promise<Card> {
    return await getOwner(this).instantiate(Card, this.jsonapi, this.csRealm, this.enclosingCard, this.service);
  }

  async validate(priorCard: AddressableCard | null, realm: AddressableCard, _forDeletion?: true) {
    // validate all present user attributes (fields-by-value)
    if (this.jsonapi.data.attributes) {
      for (let [name, value] of Object.entries(this.jsonapi.data.attributes)) {
        if (cardstackFieldPattern.test(name)) {
          continue;
        }
        let field = await this.field(name);
        field.validateValue(await priorCard?.value(name), value, realm);
      }
    }

    // validate all present user relationships (fields-by-reference)
    if (this.jsonapi.data.relationships) {
      for (let [name, ref] of Object.entries(this.jsonapi.data.relationships)) {
        if (cardstackFieldPattern.test(name)) {
          continue;
        }
        let field = await this.field(name);
        field.validateReference(await priorCard?.reference(name), relationshipToCardId(ref), realm);
      }
    }
  }

  // gets the value of a field. Its type is governed by the schema of this card.
  async value(fieldName: string): Promise<any> {
    let rawValue = this.jsonapi.data.attributes?.[fieldName];
    if (rawValue != null) {
      let field = await this.field(fieldName);
      return await field.deserializeValue(rawValue);
    }
    let ref = await this.reference(fieldName);
    if (ref != null) {
      return await this.service.get(ref);
    }
    return null;
  }

  // if the given field is stored as a reference, this gives you the reference
  // without converting it to a value like `value()` would.
  async reference(fieldName: string): Promise<CardId | undefined> {
    let ref = this.jsonapi.data.relationships?.[fieldName];
    if (ref != null) {
      return relationshipToCardId(ref);
    }
    return undefined;
  }

  async field(name: string): Promise<FieldCard> {
    let card: Card | undefined = this;
    while (card) {
      let field = card.ownFields.get(name);
      if (field) {
        return field;
      }
      card = await card.adoptsFrom();
    }
    throw new CardstackError(`no such field "${name}"`, { status: 400 });
  }

  protected regenerateJSONAPI(): SingleResourceDoc {
    let copied = cloneDeep(this.jsonapi);
    if (!copied.data.attributes) {
      copied.data.attributes = {};
    }
    copied.data.attributes.csRealm = this.csRealm;
    if (this.csRealm === this.csOriginalRealm) {
      delete copied.data.attributes.csOriginalRealm;
    } else {
      copied.data.attributes.csOriginalRealm = this.csOriginalRealm;
    }
    if (this.csId) {
      copied.data.attributes.csId = this.csId;
    }

    if (this instanceof AddressableCard) {
      copied.data.id = this.canonicalURL;
    }

    return copied;
  }

  async asPristineDoc(): Promise<PristineDocument> {
    return new PristineDocument(this.regenerateJSONAPI());
  }

  async asSearchDoc(): Promise<J.Object> {
    let doc: J.Object = Object.create(null);
    doc.csRealm = this.csRealm;
    doc.csOriginalRealm = this.csOriginalRealm;
    if (this.csId != null) {
      doc.csId = this.csId;
    }

    if (this.jsonapi.data.attributes) {
      for (let fieldName of Object.keys(this.jsonapi.data.attributes)) {
        if (cardstackFieldPattern.test(fieldName)) {
          continue;
        }
        let value = await this.value(fieldName);
        let field = await this.field(fieldName);
        doc[`${field.enclosingCard.canonicalURL}/${fieldName}`] = value;
      }
    }

    return doc;
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(this.jsonapi);
  }

  patch(otherDoc: SingleResourceDoc): void {
    this.jsonapi = mergeWith({}, this.jsonapi, otherDoc, everythingButMeta);
  }

  // This is the way that data source plugins think about card IDs. The
  // upstreamId is only unique *within* a realm.
  get upstreamId(): UpstreamIdentity | null {
    if (this.csRealm === this.csOriginalRealm) {
      if (typeof this.csId === 'string') {
        return this.csId;
      } else {
        return null;
      }
    } else {
      if (typeof this.csId === 'string') {
        return { csOriginalRealm: this.csOriginalRealm, csId: this.csId };
      } else {
        throw new CardstackError(`A card originally from a different realm must already have a csId`, {
          status: 400,
        });
      }
    }
  }

  async adoptsFrom(): Promise<AddressableCard | undefined> {
    let adoptsFromRelationship = this.jsonapi.data.relationships?.csAdoptsFrom;
    if (adoptsFromRelationship && `links` in adoptsFromRelationship) {
      let url = adoptsFromRelationship.links.related;
      if (url) {
        if (typeof url !== 'string') {
          url = url.href;
        }
        return await this.service.get(url);
      }
    }
  }

  async loadFeature(featureName: 'writer'): Promise<WriterFactory | null>;
  async loadFeature(featureName: 'indexer'): Promise<IndexerFactory<J.Value> | null>;
  async loadFeature(featureName: 'field-validate'): Promise<null | FieldHooks.validate<unknown>>;
  async loadFeature(featureName: 'field-deserialize'): Promise<null | FieldHooks.deserialize<unknown, unknown>>;
  async loadFeature(featureName: 'field-buildValueExpression'): Promise<null | FieldHooks.buildValueExpression>;
  async loadFeature(featureName: 'field-buildQueryExpression'): Promise<null | FieldHooks.buildQueryExpression>;
  async loadFeature(featureName: any): Promise<any> {
    let card: Card | undefined = this;
    while (card) {
      let result = await loadFeature(card, this.service, featureName);
      if (result) {
        return result;
      }
      card = await card.adoptsFrom();
    }
    return null;
  }

  get canonicalURL(): string | undefined {
    if (this.csId) {
      return canonicalURL({ csId: this.csId, csRealm: this.csRealm, csOriginalRealm: this.csOriginalRealm });
    }
    return undefined;
  }
}

export class UnsavedCard extends Card {
  constructor(jsonapi: SingleResourceDoc, realm: string, protected service: ScopedCardService) {
    super(jsonapi, realm, undefined, service);
  }

  async asAddressableCard(): Promise<AddressableCard> {
    if (typeof this.csId !== 'string') {
      throw new CardstackError(`card missing required attribute "csId"`);
    }
    return await this.service.instantiate(this.regenerateJSONAPI());
  }
}

export class FieldCard extends Card {
  readonly enclosingCard: Card;
  readonly csFieldArity: 'singular' | 'plural' = 'singular';

  constructor(jsonapi: SingleResourceDoc, readonly name: string, enclosingCard: Card, service: ScopedCardService) {
    super(jsonapi, enclosingCard.csRealm, enclosingCard, service);
    this.enclosingCard = enclosingCard;
  }

  async validateValue(priorFieldValue: any, value: any, realm: AddressableCard) {
    let validate = await this.loadFeature('field-validate');
    if (validate) {
      if (!(await validate(value, this))) {
        throw new CardstackError(
          `field ${this.name} on card ${
            this.enclosingCard.canonicalURL
          } failed type validation for value: ${JSON.stringify(value)}`
        );
      }
      return;
    }
    let copy = await this.clone();
    copy.patch({ data: value });
    await copy.validate(priorFieldValue, realm);
  }

  async validateReference(
    _priorReference: CardId | undefined,
    _newReference: CardId | undefined,
    _realm: AddressableCard
  ) {
    // TODO
  }

  async deserializeValue(value: any): Promise<any> {
    let deserialize = await this.loadFeature('field-deserialize');
    if (deserialize) {
      return await deserialize(value, this);
    }
    let copy = await this.clone();
    copy.patch({ data: value });
    return copy;
  }
}

export class AddressableCard extends Card implements CardId {
  // these are non-null because of the assertion in our construction that
  // ensures csId is present.
  csId!: string;
  upstreamId!: NonNullable<Card['upstreamId']>;

  constructor(jsonapi: SingleResourceDoc, service: ScopedCardService, identity?: CardId) {
    let actualRealm = identity?.csRealm ?? jsonapi.data.attributes?.csRealm;
    if (typeof actualRealm !== 'string') {
      throw new CardstackError(`card missing required attribute "realm": ${JSON.stringify(jsonapi)}`);
    }
    super(jsonapi, actualRealm, undefined, service);

    if (identity != null) {
      this.csOriginalRealm = identity.csOriginalRealm ?? identity?.csRealm;
      this.csId = identity.csId;
    }

    if ((this as any).csId == null) {
      throw new Error(`Bug: tried to use an UnsavedCard as a Card`);
    }
  }

  async clone(): Promise<AddressableCard> {
    return getOwner(this).instantiate(AddressableCard, this.jsonapi, this.service);
  }

  get canonicalURL(): string {
    return canonicalURL(this);
  }
}

export interface CardId {
  csRealm: string;
  csOriginalRealm?: string; // if not set, its implied that its equal to `realm`.
  csId: string;
}

function everythingButMeta(_objValue: any, srcValue: any, key: string) {
  if (key === 'meta') {
    // meta fields don't merge, the new entire "meta" object overwrites
    return srcValue;
  }
}

function relationshipToCardId(ref: RelationshipObject): CardId {
  if (!('links' in ref) || !ref.links.related) {
    throw new Error(`only links.related references are implemented`);
  }
  let url = typeof ref.links.related === 'string' ? ref.links.related : ref.links.related.href;
  return canonicalURLToCardId(url);
}
