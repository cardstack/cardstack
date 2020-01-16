import CardstackError from './error';
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
import { Memoize } from 'typescript-memoize';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { OcclusionRules, OcclusionFieldSets, InnerOcclusionRules } from './occlusion-rules';

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
  meta: ResponseMeta,
  rules: OcclusionRules
): Promise<PristineCollection> {
  let pristineDocs = await Promise.all(cards.map(card => card.asPristineDoc(rules)));
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

  csFiles: CardFiles | undefined;
  csPeerDependencies: PeerDependencies | undefined;

  csOcclusionRules: OcclusionFieldSets | undefined;

  private rawFields: { [name: string]: any } | undefined;
  private features: { [name: string]: string | [string, string] } | undefined;

  // if this card is stored inside another, this is the other
  readonly enclosingCard: Card | undefined;

  protected jsonapi: SingleResourceDoc;
  private attributes: SingleResourceDoc['data']['attributes'];
  private relationships: SingleResourceDoc['data']['relationships'];

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
    this.attributes = this.jsonapi.data.attributes;
    this.relationships = this.jsonapi.data.relationships;
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
      this.rawFields = fields as J.Object;
    }

    let csFiles = jsonapi.data.attributes?.csFiles;
    if (csFiles) {
      assertCSFiles(csFiles);
      this.csFiles = csFiles;
    }

    let csPeerDependencies = jsonapi.data.attributes?.csPeerDependencies;
    if (csPeerDependencies) {
      assertPeerDependencies(csPeerDependencies);
      this.csPeerDependencies = csPeerDependencies;
    }

    let features = jsonapi.data.attributes?.csFeatures;
    if (features) {
      assertFeatures(features);
      this.features = features;
    }

    if (jsonapi.data.attributes?.csAdoptsFrom) {
      throw new CardstackError(
        `csAdoptsFrom must be a reference, not a value (it must appear in data.relationships, not data.attributes)`,
        {
          status: 400,
        }
      );
    }

    if (jsonapi.data.relationships?.csAdoptsFrom) {
      if (Array.isArray(relationshipToCardId(jsonapi.data.relationships.csAdoptsFrom))) {
        throw new CardstackError(
          `The card ${this.canonicalURL} adopts from multiple parents. Multiple adoption is not allowed.`,
          {
            status: 400,
          }
        );
      }
    }
  }

  async clone(): Promise<Card> {
    return await getOwner(this).instantiate(Card, this.jsonapi, this.csRealm, this.enclosingCard, this.service);
  }

  async validate(priorCard: Card | null, realm: AddressableCard, _forDeletion?: true) {
    for (let name of this.fieldsWithData()) {
      // cast is safe because all fieldsWithData have non-null rawData
      let rawData = this.rawData(name)!;
      let priorRawData = priorCard?.rawData(name);
      let field = await this.field(name);
      if ('value' in rawData) {
        let { value } = rawData;
        this.assertArity(field, name, value);
        let priorRawValue: any = undefined;
        if (priorRawData && 'value' in priorRawData) {
          priorRawValue = priorRawData.value;
        }
        await field.validateValue(priorRawValue, value, realm);
      } else {
        let cardIds = rawData.ref;
        this.assertArity(field, name, cardIds);
        let priorRawData = priorCard?.rawData(name);
        let priorRef: CardId | CardId[] | undefined = undefined;
        if (priorRawData && 'ref' in priorRawData) {
          priorRef = priorRawData.ref;
        }
        if (Array.isArray(cardIds)) {
          await Promise.all(cardIds.map(cardId => field.validateReference(priorRef, cardId, realm)));
        } else if (cardIds) {
          await field.validateReference(priorRef, cardIds, realm);
        }
      }
    }
  }

  private assertArity(field: FieldCard, fieldName: string, value: any) {
    if (field.csFieldArity === 'plural') {
      if (!Array.isArray(value) && value != null) {
        throw new CardstackError(
          `field ${fieldName} on card ${this.canonicalURL} failed arity validation for value: ${JSON.stringify(
            value
          )}. This field has a plural arity.`,
          { status: 400 }
        );
      }
    } else {
      if (Array.isArray(value)) {
        throw new CardstackError(
          `field ${fieldName} on card ${this.canonicalURL} failed arity validation for value: ${JSON.stringify(
            value
          )}. This field has a singular arity.`,
          { status: 400 }
        );
      }
    }
  }

  private fieldsWithData(): string[] {
    let names: string[];
    if (this.attributes && this.relationships) {
      names = Object.keys(this.attributes).concat(Object.keys(this.relationships));
    } else if (this.attributes) {
      names = Object.keys(this.attributes);
    } else if (this.relationships) {
      names = Object.keys(this.relationships);
    } else {
      return [];
    }
    return names.filter(name => !cardstackFieldPattern.test(name));
  }

  private rawData(fieldName: string): { ref: CardId | CardId[] | undefined } | { value: any } | null {
    if (this.attributes) {
      if (fieldName in this.attributes) {
        return { value: this.attributes[fieldName] };
      }
    }
    if (this.relationships) {
      if (fieldName in this.relationships) {
        return { ref: relationshipToCardId(this.relationships[fieldName]) };
      }
    }
    return null;
  }

  // gets the value of a field. Its type is governed by the schema of this card.
  async value(fieldName: string): Promise<any> {
    let rawData = this.rawData(fieldName);
    if (rawData == null) {
      return rawData;
    }
    if ('value' in rawData) {
      let field = await this.field(fieldName);
      let value = rawData.value;
      if (field.csFieldArity === 'plural' && Array.isArray(value)) {
        return await Promise.all(value.map(v => field.deserializeValue(v)));
      }
      return await field.deserializeValue(value);
    } else {
      let refs = rawData.ref;
      if (refs != null && Array.isArray(refs)) {
        return await Promise.all(refs.map(ref => this.service.get(ref)));
      } else if (refs != null) {
        return await this.service.get(refs);
      }
    }
  }

  @Memoize()
  async field(name: string): Promise<FieldCard> {
    if (this.rawFields) {
      if (name in this.rawFields) {
        return await getOwner(this).instantiate(FieldCard, this.rawFields[name], name, this, this.service);
      }
    }
    let parent = await this.adoptsFrom();
    if (parent) {
      return await parent.field(name);
    } else {
      throw new CardstackError(`no such field "${name}"`, { status: 400 });
    }
  }

  @Memoize()
  async adoptionChain(): Promise<AddressableCard[]> {
    let adoptionChain: AddressableCard[] = [];
    let card: Card | undefined = this;
    while (card) {
      card = await card.adoptsFrom();
      if (card) {
        adoptionChain.push(card as AddressableCard); // parent cards are always addressable
      }
    }
    return adoptionChain;
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

    if (this.csFiles) {
      copied.data.attributes.csFiles = this.csFiles;
    } else {
      delete copied.data.attributes.csFiles;
    }

    if (this.csPeerDependencies) {
      copied.data.attributes.csPeerDependencies = this.csPeerDependencies;
    } else {
      delete copied.data.attributes.csPeerDependencies;
    }

    return copied;
  }

  @Memoize()
  private fieldSet(format: string): Map<string, InnerOcclusionRules | true> {
    let fieldSet: Map<string, InnerOcclusionRules | true> = new Map();
    if (this.csOcclusionRules?.[format]) {
      for (let fieldRule of this.csOcclusionRules[format]) {
        if (typeof fieldRule === 'string') {
          fieldSet.set(fieldRule, true);
        } else {
          fieldSet.set(fieldRule.name, fieldRule);
        }
      }
    }
    return fieldSet;
  }

  // if you want this card isolated, rules = { includeFieldSet: 'isolated' }
  async asPristineDoc(rules: OcclusionRules): Promise<PristineDocument> {
    return new PristineDocument(this.regenerateJSONAPI());
  }

  async asSearchDoc(visitedCards: string[] = []): Promise<J.Object> {
    let doc: J.Object = Object.create(null);
    doc.csRealm = this.csRealm;
    doc.csOriginalRealm = this.csOriginalRealm;
    if (this.csId != null) {
      doc.csId = this.csId;
      visitedCards.push(this.canonicalURL as string); // if csId exists, then a canonicalURL will exist as well
    }

    doc.csAdoptionChain = (await this.adoptionChain()).map(i => i.canonicalURL);

    // What about card fields that a user had decided to fill in with a
    // relationship to a card? Do we include that card in the search doc? It
    // seems kind of inconsistent that depending on how a user decided to fill
    // in a card (value vs. reference) that search doc may or may not contain a
    // card. Rather I think it would be more consistent if the policy used to
    // determine the depth of a search doc was consistent regardless of how a
    // user decided to fill in the card field.

    // I'm gonna take a stab at making this consistent for both fields filled by
    // card values and card references. We can back this out later if we decide
    // that we don't want this. The policy will be that we'll include any cards
    // that we encounter in the search doc regardless if the card is filled in
    // via value or reference. At a future time, when we add occlusion to guide
    // how to construct "embedded" cards we'll revisit this logic to make sure
    // the search doc follows the occlusion boundary.
    for (let fieldName of this.fieldsWithData()) {
      let value = await this.value(fieldName);
      let field = await this.field(fieldName);
      let fullFieldName = `${field.enclosingCard.canonicalURL}/${fieldName}`;
      if (value instanceof Card) {
        if (value.canonicalURL == null || !visitedCards.includes(value.canonicalURL)) {
          doc[fullFieldName] = await value.asSearchDoc(
            [...visitedCards, value.canonicalURL].filter(Boolean) as string[]
          );
        }
      } else if (Array.isArray(value) && value.every(i => i instanceof Card)) {
        doc[fullFieldName] = (
          await Promise.all(
            value.map(i => {
              if (i.canonicalURL == null || !visitedCards.includes(i.canonicalURL)) {
                return i.asSearchDoc([...visitedCards, i.canonicalURL].filter(Boolean) as string[]);
              }
            })
          )
        ).filter(Boolean);
      } else {
        doc[fullFieldName] = value;
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

  @Memoize()
  async adoptsFrom(): Promise<AddressableCard | undefined> {
    let baseCardURL = canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' });
    if (this.canonicalURL === baseCardURL) {
      // base card has no parent
      return;
    }

    // this cast is safe because:
    //   1. Our constructor asserted that relationships.csAdoptsFrom was
    //      singular, not plural.
    //   2. There's no way to customize the FieldCard for csAdoptsFrom to
    //      provide an alternative deserialize() hook.
    let card = (await this.value('csAdoptsFrom')) as AddressableCard | null;
    if (card) {
      return card;
    }

    return await this.service.get({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' });
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
      if (card.features && featureName in card.features) {
        let location = card.features[featureName];
        if (typeof location === 'string') {
          return await this.modules.load(card, location);
        } else {
          return await this.modules.load(card, ...location);
        }
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
    if (typeof jsonapi.data.attributes?.csFieldArity === 'string') {
      this.csFieldArity = jsonapi.data.attributes?.csFieldArity === 'plural' ? 'plural' : 'singular';
    }
  }

  async validateValue(priorFieldValue: any, value: any, realm: AddressableCard) {
    let validate = await this.loadFeature('field-validate');
    if (validate) {
      if (this.csFieldArity === 'plural' && Array.isArray(value)) {
        let validations = await Promise.all(value.map(v => validate!(v, this)));
        if (!validations.every(Boolean)) {
          let invalidItems = validations
            .map((isValid, index) => (!isValid ? { index, value: value[index] } : null))
            .filter(Boolean);
          throw new CardstackError(
            `field ${this.name} on card ${
              this.enclosingCard.canonicalURL
            } failed type validation for values: ${JSON.stringify(invalidItems)}`,
            { status: 400 }
          );
        }
        return;
      } else {
        if (!(await validate(value, this))) {
          throw new CardstackError(
            `field ${this.name} on card ${
              this.enclosingCard.canonicalURL
            } failed type validation for value: ${JSON.stringify(value)}`,
            { status: 400 }
          );
        }
        return;
      }
    }

    if (this.csFieldArity === 'plural' && Array.isArray(value)) {
      await Promise.all(
        value.map(async v => {
          let copy = await this.clone();
          copy.patch({ data: v });
          // TODO: this priorFieldValue is an array of raw (still serialized)
          // card values. It needs to get deserialized and then matched by
          // identity with each `v`.
          await copy.validate(priorFieldValue, realm);
        })
      );
    } else {
      let newValueCard = await this.clone();
      newValueCard.patch({ data: value });
      let oldValueCard = await this.clone();
      oldValueCard.patch({ data: priorFieldValue });
      await newValueCard.validate(oldValueCard, realm);
    }
  }

  async validateReference(
    _priorReferenceOrReferences: CardId | CardId[] | undefined,
    newReferenceOrReferences: CardId | CardId[] | undefined,
    _realm: AddressableCard
  ) {
    if (!newReferenceOrReferences) {
      return;
    }
    // just validating that newReference adopts from the same parent as the field card for now...
    let fieldType = await this.adoptsFrom();
    if (!fieldType) {
      return;
    }

    // I don't think we should allow references to cards that don't exist yet.
    // We can get into really awkward situations where a relationship to a
    // not-yet-created card would imply the not-yet-created-card to have a
    // particular card type and you would get a validation error when you create
    // your not-yet-created card because some other card has assumptions about
    // what kind of card you should be. This could even be extended to multiple
    // cards having a relationship to a not-yet-created-card with conflicting
    // card-types that has an impossible adoption chain--thereby preventing any
    // card with the referenced card ID from ever being created (potential
    // attack vector?). The only situation where this would not be a problem
    // would be if the field card adopts directly from the base card (meaning
    // any card can be present in this field).
    let newReferences = Array.isArray(newReferenceOrReferences) ? newReferenceOrReferences : [newReferenceOrReferences];
    await Promise.all(
      newReferences.map(async newRef => {
        let referencedCard = await this.service.get(newRef); // let a 404 error be thrown when not found
        let card = referencedCard;
        while (card) {
          let parent = await card.adoptsFrom();
          if (!parent) {
            break;
          }
          if (parent.canonicalURL === fieldType!.canonicalURL) {
            return;
          }
          card = parent;
        }
        throw new CardstackError(
          `field ${this.name} on card ${this.enclosingCard.canonicalURL} failed card-type validation for reference: ${
            referencedCard.canonicalURL
          }. The referenced card must adopt from: ${fieldType!.canonicalURL}`,
          { status: 400 }
        );
      })
    );
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
      throw new CardstackError(`card missing required attribute "csRealm": ${JSON.stringify(jsonapi)}`);
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

interface CardFiles {
  [filename: string]: string | CardFiles;
}

function assertCSFiles(files: any, pathContext = [] as string[]): asserts files is CardFiles {
  if (!isPlainObject(files)) {
    if (pathContext.length === 0) {
      throw new Error(`csFiles must be an object`);
    } else {
      throw new Error(`invalid csFiles contents for file ${pathContext.join('/')}`);
    }
  }
  for (let [name, value] of Object.entries(files)) {
    if (name.includes('/')) {
      throw new Error(`filename ${name} in csFiles cannot contain a slash. You can make subdirectories by nesting.`);
    }
    if (typeof value === 'string') {
      continue;
    }
    assertCSFiles(value, [...pathContext, name]);
  }
}

interface PeerDependencies {
  [packageName: string]: string;
}
function assertPeerDependencies(deps: any): asserts deps is PeerDependencies {
  if (!isPlainObject(deps)) {
    throw new Error(`csPeerDependencies must be an object`);
  }
  for (let [name, value] of Object.entries(deps)) {
    if (typeof value !== 'string') {
      throw new Error(`csPeerDependencies.${name} must be a string`);
    }
  }
}

function assertFeatures(features: any): asserts features is Card['features'] {
  if (!isPlainObject(features)) {
    throw new Error(`csFeatures must be an object`);
  }
  for (let [name, value] of Object.entries(features)) {
    if (typeof value === 'string') {
      continue;
    }
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && typeof value[1] === 'string') {
      continue;
    }
    throw new Error(
      `csFeatures.${name} must be "moduleName: string" or "[moduleName, exportedName]: [string, string]"`
    );
  }
}

function everythingButMeta(_objValue: any, srcValue: any, key: string) {
  if (key === 'meta') {
    // meta fields don't merge, the new entire "meta" object overwrites
    return srcValue;
  }
}

function relationshipToCardId(ref: RelationshipObject): CardId | CardId[] | undefined {
  if ('links' in ref && ref.links.related) {
    let url = typeof ref.links.related === 'string' ? ref.links.related : ref.links.related.href;
    return canonicalURLToCardId(url);
  }

  if ('data' in ref) {
    if (!Array.isArray(ref.data) && ref.data?.type === 'cards' && ref.data?.id) {
      return canonicalURLToCardId(ref.data.id);
    } else if (
      Array.isArray(ref.data) &&
      ref.data.every(i => i.type === 'cards') &&
      ref.data.every(i => i.id != null)
    ) {
      return ref.data.map(i => canonicalURLToCardId(i.id));
    }
  }
}
