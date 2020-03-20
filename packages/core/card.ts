import CardstackError from './error';
import { UpstreamDocument, UpstreamIdentity, ResponseMeta } from './document';
import {
  SingleResourceDoc,
  RelationshipObject,
  ResourceObject,
  AttributesObject,
  RelationshipsObject,
  CollectionResourceDoc,
} from 'jsonapi-typescript';
import cloneDeep from 'lodash/cloneDeep';
import isPlainObject from 'lodash/isPlainObject';
import merge from 'lodash/merge';
import get from 'lodash/get';
import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';
import difference from 'lodash/difference';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';
import * as J from 'json-typescript';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { OcclusionFieldSets, assertOcclusionFieldSets, Format, OcclusionRules } from './occlusion-rules';
import { Container } from './container';
import { ModuleLoader } from './module-loader';
import { CardReader } from './card-reader';
import { CardInstantiator } from './card-instantiator';
import { Memoize } from 'typescript-memoize';
import * as FieldHooks from './field-hooks';
import { WriterFactory } from './writer';
import { IndexerFactory } from './indexer';
import { CardId, FieldArity, canonicalURLToCardId, canonicalURL, cardstackFieldPattern } from './card-id';
import { CardDocument, cardDocumentFromJsonAPI } from './card-document';
import Component from '@glimmer/component';
import assertNever from 'assert-never';

let nonce = 0;

const nonJSFileExtenstions = Object.freeze(['css']);
export const apiPrefix = '/api';

export async function makeCollection(
  cards: AddressableCard[],
  meta: ResponseMeta,
  rules?: OcclusionRules
): Promise<CollectionResourceDoc> {
  let pristineDocs = await Promise.all(cards.map(card => card.serializeAsJsonAPIDoc(rules)));
  let doc: CollectionResourceDoc = {
    data: pristineDocs.map(doc => doc.data),
    meta: (meta as unknown) as J.Object,
  };
  let included = uniqBy(flatten(pristineDocs.map(i => i.included).filter(Boolean)), 'id') as ResourceObject[];
  if (included.length) {
    doc.included = included;
  }
  return doc;
}

export class Card {
  // This is the realm the card is stored in.
  readonly csRealm: string;

  // this is the realm the card was first created in. As a card is copied to
  // other realms, `card.csRealm` changes but `card.csOriginalRealm` does not.
  readonly csOriginalRealm: string;

  // the csId distinguishes the card within its originalRealm. In some cases
  // it may be chosen by the person creating the card. In others it may be
  // chosen by the hub.
  readonly csId: string | undefined;

  // this is a really basic means to provide all the cards (including
  // UnsavedCards and interior cards) some form of identity within the container
  readonly nonce: number = ++nonce;

  readonly csTitle: string | undefined;
  readonly csDescription: string | undefined;
  readonly csFiles: CardFiles | undefined;
  readonly csPeerDependencies: PeerDependencies | undefined;
  readonly csFieldSets: OcclusionFieldSets | undefined;
  readonly csFields: { [name: string]: any } | undefined;
  readonly csFeatures: { [name: string]: string | [string, string] } | undefined;
  readonly csFieldOrder: FieldOrder | undefined;

  // Interior cards do not have an independent csCreated/csUpdated value
  readonly csCreated: Date | undefined;
  readonly csUpdated: Date | undefined;

  // If this card is stored inside another, this is the card that originally
  // defined this card (which may be a prior ancestor in the adoption chain from
  // the direct enclosing card). Not to be confused with the enclosingCard which
  // is the immediate card enclosing this card irrespective of adoption chain.
  // In terms of FieldCards, the enclosing card is the card that holds the value
  // for the field card, where the source card is the card that defined the
  // schema for the FieldCard (and may not necessarily be the card that holds the
  // value for the field).
  readonly sourceCard: Card | undefined;

  private readonly attributes: SingleResourceDoc['data']['attributes'];
  private readonly relationships: SingleResourceDoc['data']['relationships'];
  readonly meta: SingleResourceDoc['data']['meta'];

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
    sourceCard: Card | undefined,
    protected reader: CardReader,
    protected modules: ModuleLoader,
    protected container: Container
  ) {
    if (typeof jsonapi.data.attributes === 'object' && typeof jsonapi.data.relationships === 'object') {
      let dupeFields = intersection(Object.keys(jsonapi.data.attributes), Object.keys(jsonapi.data.relationships));
      if (dupeFields.length) {
        throw new CardstackError(
          `The field${dupeFields.length > 1 ? 's' : ''} ${dupeFields.join(
            ','
          )} cannot appear in both the relationships and attributes of a card`,
          {
            status: 400,
          }
        );
      }
    }

    this.attributes = jsonapi.data.attributes;
    this.relationships = jsonapi.data.relationships;
    this.meta = jsonapi.data.meta;

    this.sourceCard = sourceCard;
    this.csRealm = realm;
    this.csOriginalRealm =
      typeof jsonapi.data.attributes?.csOriginalRealm === 'string' ? jsonapi.data.attributes.csOriginalRealm : realm;

    if (typeof jsonapi.data.attributes?.csId === 'string') {
      this.csId = jsonapi.data.attributes?.csId;
    }

    let csFields = jsonapi.data.attributes?.csFields;
    if (csFields) {
      if (!isPlainObject(csFields)) {
        throw new CardstackError(`csFields must be an object`, { status: 400 });
      }
      let invalidUserField = Object.keys(csFields).find(field => cardstackFieldPattern.test(field));
      if (invalidUserField) {
        throw new CardstackError(
          `Cannot create user field '${invalidUserField}'. 'cs' prefixed fields are reserved for system use only.`,
          { status: 400 }
        );
      }
      this.csFields = csFields as J.Object;
    }

    if (typeof jsonapi.data.attributes?.csTitle === 'string') {
      this.csTitle = jsonapi.data.attributes?.csTitle;
    }

    if (typeof jsonapi.data.attributes?.csDescription === 'string') {
      this.csDescription = jsonapi.data.attributes?.csDescription;
    }

    if (typeof jsonapi.data.attributes?.csCreated === 'string' && !sourceCard) {
      this.csCreated = new Date(jsonapi.data.attributes?.csCreated);
    } else if (!sourceCard) {
      this.csCreated = new Date();
      this.csUpdated = this.csCreated;
    }

    if (typeof jsonapi.data.attributes?.csUpdated === 'string' && !sourceCard) {
      this.csUpdated = new Date(jsonapi.data.attributes?.csUpdated);
    }

    let csFieldOrder = jsonapi.data.attributes?.csFieldOrder;
    if (csFieldOrder) {
      assertFieldOrder(csFieldOrder);
      this.csFieldOrder = csFieldOrder;
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

    let csFeatures = jsonapi.data.attributes?.csFeatures;
    if (csFeatures) {
      assertFeatures(csFeatures);
      this.csFeatures = csFeatures;
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

    let csFieldSets = jsonapi.data.attributes?.csFieldSets;
    if (csFieldSets) {
      assertOcclusionFieldSets(csFieldSets, `csFieldSets`);
      this.csFieldSets = csFieldSets;
    }
  }

  @Memoize()
  get document(): CardDocument {
    let jsonapi: SingleResourceDoc = { data: { type: 'cards' } };
    if (this.attributes) {
      jsonapi.data.attributes = this.attributes;
    }
    if (this.relationships) {
      jsonapi.data.relationships = this.relationships;
    }
    if (this.meta) {
      jsonapi.data.meta = this.meta;
    }
    return cardDocumentFromJsonAPI(jsonapi);
  }

  async validate(priorCard: Card | null, realm: AddressableCard, _forDeletion?: true) {
    for (let name of this.fieldsWithData()) {
      // cast is safe because all fieldsWithData have non-null rawData
      let rawData = (await this.rawData(name))!;
      let priorRawData = await priorCard?.rawData(name);
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
        let priorRawData = await priorCard?.rawData(name);
        let priorRef: CardId | CardId[] | null = null;
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

    if (this.csFieldOrder) {
      for (let fieldName of this.csFieldOrder) {
        await this.field(fieldName); // nonexistant fields will throw here
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

  @Memoize()
  private async allFieldNames(): Promise<string[]> {
    let fields = [];
    for (let card of [this, ...(await this.adoptionChain())]) {
      if (card.csFields) {
        for (let name of Object.keys(card.csFields)) {
          fields.push(name);
        }
      }
    }
    return fields;
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

  private async rawData(fieldName: string): Promise<RawData> {
    // in the scenario where we are validating the prior card, we might
    // encounter a newly added field that exists in the updated card, but not
    // the prior card.
    if (!(await this.hasField(fieldName))) {
      return null;
    }

    let field = await this.field(fieldName);
    let compute = await field.loadFeature('compute');
    if (compute) {
      return await compute({ field, card: this });
    }
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
    let field = await this.field(fieldName);
    let rawData = await this.rawData(fieldName);
    if (rawData == null) {
      if (field.csFieldArity === 'plural') {
        return [];
      } else {
        return null;
      }
    }
    if ('value' in rawData) {
      let field = await this.field(fieldName);
      let value = rawData.value;
      if (field.csFieldArity === 'plural' && Array.isArray(value)) {
        return await Promise.all(value.map(v => field.deserializeValue(v)));
      } else {
        return await field.deserializeValue(value);
      }
    } else {
      let refs = rawData.ref;
      if (refs != null && Array.isArray(refs)) {
        return await Promise.all(refs.map(ref => this.reader.get(ref)));
      } else if (refs != null) {
        return await this.reader.get(refs);
      }
    }
  }

  @Memoize()
  async field(name: string): Promise<FieldCard> {
    let field = await this._field(name, this);
    if (!field) {
      throw new CardstackError(`no such field "${name}"`, { status: 400 });
    }
    return field;
  }

  @Memoize()
  async hasField(name: string): Promise<boolean> {
    return Boolean(await this._field(name, this));
  }

  private async _field(name: string, enclosingCard: Card): Promise<FieldCard | undefined> {
    let data;

    if (name === 'csAdoptsFrom') {
      data = {};
    } else if (this.csFields && name in this.csFields) {
      data = this.csFields[name];
    } else {
      let parent = await this.adoptsFrom();
      if (parent) {
        return await parent._field(name, enclosingCard);
      }
      return;
    }

    return await this.container.instantiate(
      FieldCard,
      merge({ data: { type: 'cards' } }, { data }),
      name,
      this,
      enclosingCard,
      this.reader,
      this.modules,
      this.container
    );
  }

  @Memoize()
  async fields(rules: OcclusionRules = { includeFieldSet: 'everything' }): Promise<FieldCard[]> {
    let fields: FieldCard[] = [];
    let card: Card | undefined = this;
    while (card) {
      if (card.csFields) {
        for (let name of Object.keys(card.csFields)) {
          let fieldRules = await this.rulesForField(name, rules);
          if (!fieldRules) {
            continue;
          }
          let field = await card._field(name, this);
          if (!field) {
            throw new CardstackError(`no such field "${name}"`, { status: 400 });
          }
          fields.push(field);
        }
      }
      card = await card.adoptsFrom();
    }
    return fields;
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

  private async rulesForField(fieldName: string, rules: OcclusionRules): Promise<OcclusionRules | false> {
    if (rules.includeFields) {
      if (rules.includeFields.includes(fieldName)) {
        // the shorthand form defaults to meaning "embedded"
        return { includeFieldSet: 'embedded' };
      }
      for (let rule of rules.includeFields) {
        if (typeof rule !== 'string' && rule.name === fieldName) {
          return rule;
        }
      }
    }
    if (rules.includeFieldSet) {
      let set = await this.fieldSet(rules.includeFieldSet);
      let rule = set.get(fieldName);
      if (rule) {
        return rule;
      }
    }
    // do not include this field at all
    return false;
  }

  @Memoize()
  private async fieldSet(format: Format): Promise<Map<string, OcclusionRules>> {
    let fieldSet: Map<string, OcclusionRules> = new Map();

    if (format === 'everything') {
      for (let fieldName of await this.allFieldNames()) {
        fieldSet.set(fieldName, { includeFieldSet: 'everything' });
      }
      fieldSet.set('csAdoptsFrom', { includeFieldSet: 'everything' });
      return fieldSet;
    }

    if (format === 'upstream') {
      for (let fieldName of await this.allFieldNames()) {
        let field = await this.field(fieldName);
        if (!(await field.isComputed())) {
          fieldSet.set(fieldName, { includeFieldSet: 'upstream' });
        }
      }
      fieldSet.set('csAdoptsFrom', { includeFieldSet: 'upstream' });
      return fieldSet;
    }

    if (this.csFieldSets?.[format]) {
      for (let fieldRule of this.csFieldSets[format]) {
        if (typeof fieldRule === 'string') {
          fieldSet.set(fieldRule, { includeFieldSet: 'embedded' });
        } else {
          fieldSet.set(fieldRule.name, fieldRule);
        }
      }
      return fieldSet;
    }

    let parent = await this.adoptsFrom();
    if (parent) {
      return await parent.fieldSet(format);
    } else {
      return fieldSet;
    }
  }

  private async serialize(rules: OcclusionRules, included: Map<string, OcclusionRules[]>): Promise<ResourceObject> {
    let data = Object.create(null);

    if (this.csId != null) {
      data.id = this.canonicalURL;
    }

    data.type = 'cards';
    data.attributes = Object.create(null);

    // Don't put the csRealm in the upstream doc--its redundant, and makes the
    // cards less portable (e.g. resuing a card from a files realm in a git
    // realm).
    if (rules.includeFieldSet !== 'upstream') {
      data.attributes.csRealm = this.csRealm;
    }

    if (this.csRealm !== this.csOriginalRealm) {
      data.attributes.csOriginalRealm = this.csOriginalRealm;
    }
    if (this.csId != null) {
      data.attributes.csId = this.csId;
    }
    if (this.csTitle != null) {
      data.attributes.csTitle = this.csTitle;
    }
    if (this.csDescription != null) {
      data.attributes.csDescription = this.csDescription;
    }
    if (this.csFields) {
      data.attributes.csFields = this.csFields;
    }
    if (this.csFeatures) {
      data.attributes.csFeatures = this.csFeatures;
    }
    if (this.csFiles) {
      data.attributes.csFiles = this.csFiles;
    }
    if (this.csFieldOrder) {
      data.attributes.csFieldOrder = this.csFieldOrder;
    }
    if (this.csPeerDependencies) {
      data.attributes.csPeerDependencies = this.csPeerDependencies;
    }
    if (this.csFieldSets) {
      data.attributes.csFieldSets = this.csFieldSets;
    }
    if (this.csCreated) {
      data.attributes.csCreated = this.csCreated.toISOString();
    }
    if (this.csUpdated) {
      data.attributes.csUpdated = this.csUpdated.toISOString();
    }

    data.relationships = Object.create(null);
    let adoptsFrom = this.adoptsFromId;
    if (adoptsFrom) {
      let url = canonicalURL(adoptsFrom);
      data.relationships.csAdoptsFrom = {
        data: {
          type: 'cards',
          id: url,
        },
      };
      let fieldRules = await this.rulesForField('csAdoptsFrom', rules);
      if (fieldRules) {
        // you're allowed to include csAdoptsFrom in the occlusion rules, in
        // which case it can end up in included
        let includedRules = included.get(url) || [];
        includedRules.push(fieldRules);
        included.set(url, includedRules);
      }
    }

    for (let fieldName of await this.allFieldNames()) {
      let rawData = await this.rawData(fieldName);
      if (!rawData) {
        continue;
      }
      let fieldRules = await this.rulesForField(fieldName, rules);
      if (!fieldRules) {
        continue;
      }
      let field = await this.field(fieldName);
      if ('value' in rawData) {
        await this.applyRulesForAttribute(data.attributes, field, fieldRules, rawData.value, included);
      } else {
        await this.applyRulesForRelationship(data.relationships, field, fieldRules, rawData.ref, included);
      }
    }

    if (this.meta) {
      data.meta = this.meta;
    }

    return data;
  }

  private async serializeIncluded(included: Map<string, OcclusionRules[]>): Promise<ResourceObject[]> {
    let resources: ResourceObject[] = [];
    while (true) {
      let foundMoreIncluded = new Map<string, OcclusionRules[]>();
      await Promise.all(
        [...included].map(async ([canonicalURL, rulesArray]) => {
          let card = await this.reader.get(canonicalURL);
          let rules = mergeRules(rulesArray);
          resources.push(await card.serialize(rules, foundMoreIncluded));
        })
      );
      // Using this approach so we can break cycles in the included graph
      let newIncludedIds = difference([...foundMoreIncluded.keys()], [...included.keys()]);
      if (newIncludedIds.length === 0) {
        return uniqBy(resources, 'id');
      }
      for (let newIncludedId of newIncludedIds) {
        included.set(newIncludedId, foundMoreIncluded.get(newIncludedId)!);
      }
    }
  }

  private async applyRulesForAttribute(
    attributes: AttributesObject,
    field: FieldCard,
    rules: OcclusionRules,
    data: any,
    included: Map<string, OcclusionRules[]>
  ): Promise<void> {
    if (await field.hasFeature('field-deserialize')) {
      // this field's value is not a Card, it's a scalar. So no deeper occlusion
      // is needed, the whole value is in.
      attributes[field.name] = data;
      return;
    }

    let cardOrCards = await this.value(field.name);
    if (field.csFieldArity === 'plural') {
      let cards = cardOrCards as Card[];
      attributes[field.name] = (await Promise.all(cards.map(card => card.asInteriorCard(rules, included)))) as J.Arr;
    } else {
      let card = cardOrCards as Card;
      attributes[field.name] = (await card.asInteriorCard(rules, included)) as J.Value;
    }
  }

  private async applyRulesForRelationship(
    relationships: RelationshipsObject,
    field: FieldCard,
    rules: OcclusionRules,
    reference: CardId | CardId[] | null,
    included: Map<string, OcclusionRules[]>
  ): Promise<void> {
    if (field.csFieldArity === 'plural') {
      relationships[field.name] = {
        data: (reference as CardId[]).map(id => ({ type: 'cards', id: canonicalURL(id) })),
      };
    } else if (reference) {
      relationships[field.name] = {
        data: { type: 'cards', id: canonicalURL(reference as CardId) },
      };
    } else {
      relationships[field.name] = { data: null };
    }

    if (!reference) {
      return;
    }

    if (Array.isArray(reference)) {
      for (let id of reference) {
        let includedRules = included.get(canonicalURL(id)) || [];
        includedRules.push(rules);
        included.set(canonicalURL(id), includedRules);
      }
    } else {
      let includedRules = included.get(canonicalURL(reference)) || [];
      includedRules.push(rules);
      included.set(canonicalURL(reference), includedRules);
    }
  }

  private async asInteriorCard(
    rules: OcclusionRules = { includeFieldSet: 'everything' },
    includedMap: Map<string, OcclusionRules[]>
  ): Promise<CardValue> {
    this.serialize(rules, includedMap);
    let { id, attributes, relationships } = await this.serialize(rules, includedMap);
    let interiorJson: CardValue = {};
    if (id != null) {
      interiorJson.id = id;
    }
    if (attributes) {
      interiorJson.attributes = attributes;
    }
    if (relationships) {
      interiorJson.relationships = relationships;
    }
    return interiorJson;
  }

  // we might wanna think about getting rid of the PristineDocument Type and just use this instead...
  async serializeAsJsonAPIDoc(rules: OcclusionRules = { includeFieldSet: 'everything' }): Promise<SingleResourceDoc> {
    let includedMap = new Map<string, OcclusionRules[]>();
    let data = await this.serialize(rules, includedMap);
    let jsonapi: SingleResourceDoc = { data };
    let included = (await this.serializeIncluded(includedMap)).filter(i => i.id !== this.canonicalURL);
    if (included.length) {
      jsonapi.included = included;
    }
    return jsonapi;
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(await this.serializeAsJsonAPIDoc({ includeFieldSet: 'upstream' }));
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

    if (typeof this.csTitle === 'string') {
      doc.csTitle = this.csTitle;
    }
    if (typeof this.csDescription === 'string') {
      doc.csDescription = this.csDescription;
    }
    if (this.csCreated) {
      doc.csCreated = this.csCreated.toISOString();
    }
    if (this.csUpdated) {
      doc.csUpdated = this.csUpdated.toISOString();
    }

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
    for (let fieldName of await this.allFieldNames()) {
      let value = await this.value(fieldName);
      let field = await this.field(fieldName);
      let fullFieldName = `${field.sourceCard.canonicalURL}/${fieldName}`;
      if (await field.isScalar()) {
        doc[fullFieldName] = value;
      } else {
        switch (field.csFieldArity) {
          case 'singular':
            if (value) {
              let card = value as Card;
              if (card.canonicalURL == null || !visitedCards.includes(card.canonicalURL)) {
                doc[fullFieldName] = await card.asSearchDoc(
                  [...visitedCards, card.canonicalURL].filter(Boolean) as string[]
                );
              }
            } else {
              doc[fullFieldName] = null;
            }
            break;
          case 'plural':
            {
              let cards = value as Card[];
              doc[fullFieldName] = (
                await Promise.all(
                  cards.map(i => {
                    if (i.canonicalURL == null || !visitedCards.includes(i.canonicalURL)) {
                      return i.asSearchDoc([...visitedCards, i.canonicalURL].filter(Boolean) as string[]);
                    }
                  })
                )
              ).filter(Boolean) as J.Object[];
            }
            break;
          default:
            assertNever(field.csFieldArity);
        }
      }
    }

    return doc;
  }

  protected async patchDoc(target: SingleResourceDoc, source: SingleResourceDoc): Promise<SingleResourceDoc> {
    let interiorCard: CardValue = Object.create(null);
    let otherInteriorCard: CardValue = Object.create(null);
    if (target.data?.attributes) {
      interiorCard.attributes = target.data.attributes;
    }
    if (source.data?.attributes) {
      otherInteriorCard.attributes = source.data.attributes;
    }
    if (target.data?.relationships) {
      interiorCard.relationships = target.data.relationships;
    }
    if (source.data?.relationships) {
      otherInteriorCard.relationships = source.data.relationships;
    }
    let patched = await this.patchInteriorCards(interiorCard, otherInteriorCard);

    // Cleanup any field values whose field definitions were removed as a result of the merge
    // TODO what about interior cards whose csField definitions have changed?
    let csAdoptsFrom = patched?.relationships?.csAdoptsFrom;
    let parentURL: string | undefined;
    if (csAdoptsFrom && 'data' in csAdoptsFrom && csAdoptsFrom.data && !Array.isArray(csAdoptsFrom.data)) {
      parentURL = csAdoptsFrom.data.id;
    }
    let parent = await this.reader.get(
      parentURL ? canonicalURLToCardId(parentURL) : { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' }
    );
    let fieldNames = [...(await parent.fields()).map(i => i.name), ...Object.keys(patched?.attributes?.csFields || {})];
    let removedFields = difference(
      [
        ...Object.keys(patched?.attributes || {}).filter(i => !cardstackFieldPattern.test(i)),
        ...Object.keys(patched?.relationships || {}).filter(i => !cardstackFieldPattern.test(i)),
      ],
      fieldNames
    );
    for (let field of removedFields) {
      if (patched?.attributes) {
        delete patched.attributes[field];

        if (
          patched.attributes.csFieldOrder &&
          Array.isArray(patched.attributes.csFieldOrder) &&
          patched.attributes.csFieldOrder.includes(field)
        ) {
          patched.attributes.csFieldOrder.splice(patched.attributes.csFieldOrder.indexOf(field), 1);
        }
      }
      if (patched?.relationships) {
        delete patched.relationships[field];
      }
    }

    let patchedDoc: SingleResourceDoc = {
      data: {
        type: 'cards',
        ...(patched || {}),
      },
    };
    if (source.data?.id != null) {
      patchedDoc.data.id = source.data.id;
    }
    if (source.data?.meta) {
      patchedDoc.data.meta = cloneDeep(source.data.meta);
    } else if (target.data?.meta) {
      patchedDoc.data.meta = cloneDeep(target.data.meta);
    }
    return patchedDoc;
  }

  async patch(otherDoc: SingleResourceDoc): Promise<Card> {
    let newDoc = await this.patchDoc(
      merge((await this.asUpstreamDoc()).jsonapi, { data: { attributes: { csRealm: this.csRealm } } }),
      otherDoc
    );
    return await this.container.instantiate(
      Card,
      newDoc,
      this.csRealm,
      this.sourceCard,
      this.reader,
      this.modules,
      this.container
    );
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

    let adoptsFromId = this.adoptsFromId;
    if (adoptsFromId) {
      return await this.reader.get(adoptsFromId);
    }
    return await this.reader.get({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' });
  }

  get adoptsFromId(): CardId | undefined {
    let baseCardURL = canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' });
    if (this.canonicalURL === baseCardURL) {
      // base card has no parent
      return undefined;
    }
    if (this.relationships?.csAdoptsFrom) {
      return relationshipToCardId(this.relationships.csAdoptsFrom) as CardId | undefined;
    }
    return { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' };
  }
  get adoptsFromURL(): string | undefined {
    let id = this.adoptsFromId;
    if (id) {
      return canonicalURL(id);
    }
    return undefined;
  }

  @Memoize()
  async hasFeature(featureName: string): Promise<boolean> {
    if (this.csFeatures && featureName in this.csFeatures) {
      return true;
    }
    let parent = await this.adoptsFrom();
    if (parent) {
      return parent.hasFeature(featureName);
    }
    return false;
  }

  async loadFeature(featureName: 'writer'): Promise<WriterFactory | null>;
  async loadFeature(featureName: 'indexer'): Promise<IndexerFactory | null>;
  async loadFeature(featureName: 'field-validate'): Promise<null | FieldHooks.validate<unknown>>;
  async loadFeature(featureName: 'field-deserialize'): Promise<null | FieldHooks.deserialize<unknown, unknown>>;
  async loadFeature(featureName: 'field-buildValueExpression'): Promise<null | FieldHooks.buildValueExpression>;
  async loadFeature(featureName: 'field-buildQueryExpression'): Promise<null | FieldHooks.buildQueryExpression>;
  async loadFeature(featureName: 'isolated-layout'): Promise<null | Component>;
  async loadFeature(featureName: 'embedded-layout'): Promise<null | Component>;
  async loadFeature(featureName: 'field-view-layout'): Promise<null | Component>;
  async loadFeature(featureName: 'field-edit-layout'): Promise<null | Component>;
  async loadFeature(featureName: 'isolated-css'): Promise<null | string>;
  async loadFeature(featureName: 'embedded-css'): Promise<null | string>;
  async loadFeature(featureName: 'compute'): Promise<null | ((context: { field: FieldCard; card: Card }) => RawData)>;
  async loadFeature(featureName: string): Promise<any> {
    let card: Card | undefined = this;
    while (card) {
      if (card.csFeatures && featureName in card.csFeatures) {
        let location = card.csFeatures[featureName];
        if (typeof location === 'string') {
          // For the non-js based resources, just return the file contents
          let fileContents: string | undefined;
          let [, extension] = location.split('.');
          if (
            extension &&
            nonJSFileExtenstions.includes(extension) &&
            (fileContents = get(card.csFiles, location.replace(/\//g, '.')) as string) != null
          ) {
            return fileContents;
          } else if (!extension || !nonJSFileExtenstions.includes(extension)) {
            return await this.modules.load(card, location);
          }
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

  private async patchInteriorCards(
    target: CardValue | null | undefined,
    source: CardValue | null | undefined
  ): Promise<CardValue | null> {
    if (!source && !target) {
      return null;
    }
    if (!target && source) {
      return cloneDeep(source);
    }
    if (!source && target) {
      return cloneDeep(target);
    }

    let merged = Object.create(null);
    if (target?.id != null || source?.id != null) {
      merged.id = source?.id ?? target?.id;
    }

    if (target?.relationships || source?.relationships) {
      merged.relationships = Object.create(null);
      for (let doc of [target, source]) {
        for (let [key, value] of Object.entries(doc?.relationships || {})) {
          if (value == null || !('data' in value)) {
            // we dont merge "links" style relationships, only "data" style relationships
            merged!.relationships[key] = null;
            continue;
          }
          if (Array.isArray(value.data)) {
            merged.relationships[key] = { data: [...value.data] };
          } else if (isPlainObject(value.data)) {
            merged.relationships[key] = { data: { ...value.data } };
          } else if (value.data == null) {
            merged.relationships[key].data = null;
          }
        }
      }
    }

    if (target?.attributes || source?.attributes) {
      merged.attributes = Object.create(null);
      for (let doc of [target, source]) {
        for (let [key, value] of Object.entries(doc?.attributes || {})) {
          if (
            Array.isArray(value) &&
            !cardstackFieldPattern.test(key) &&
            (value.length === 0 ||
              value.every(
                interiorCard =>
                  typeof interiorCard === 'object' &&
                  !Array.isArray(interiorCard) &&
                  isPlainObject(interiorCard) &&
                  interiorCard!.id != null
              ))
          ) {
            // this is a collection of interior cards with identity mappings
            merged.attributes[key] = await Promise.all(
              value.map(interiorCard =>
                this.patchInteriorCards(
                  ((target?.attributes?.[key] || []) as CardValue[]).find(
                    i => i.id === (interiorCard as CardValue)!.id
                  ),
                  ((source?.attributes?.[key] || []) as CardValue[]).find(i => i.id === (interiorCard as CardValue)!.id)
                )
              )
            );
          } else if (isPlainObject(value) && !cardstackFieldPattern.test(key)) {
            // we are making an assumption that we dont want to apply interior
            // card patching logic in the system fields. Currently the closest we
            // come to this is the csFields--but we really don't want to apply
            // interior card patching logic for that, otherwise we wont be able to
            // remove fields from a card.
            merged.attributes[key] = await this.patchInteriorCards(
              target?.attributes?.[key] as CardValue | null | undefined,
              source?.attributes?.[key] as CardValue | null | undefined
            );
          } else if (typeof value !== 'object') {
            merged.attributes[key] = value;
          } else {
            merged.attributes[key] = cloneDeep(value);
          }
        }
      }
    }

    return merged as CardValue;
  }
}

export class UnsavedCard extends Card {
  readonly isUnsaved = true;

  constructor(
    jsonapi: SingleResourceDoc,
    realm: string,
    protected reader: CardReader,
    modules: ModuleLoader,
    container: Container,
    private cardInstantiator: CardInstantiator
  ) {
    super(jsonapi, realm, undefined, reader, modules, container);
  }

  async asAddressableCard(patch: SingleResourceDoc): Promise<AddressableCard> {
    let newDoc = await this.patchDoc(
      merge((await this.asUpstreamDoc()).jsonapi, { data: { attributes: { csRealm: this.csRealm } } }),
      patch
    );
    return await this.cardInstantiator.instantiate(newDoc);
  }
}

export class FieldCard extends Card {
  readonly csFieldArity: FieldArity = 'singular';

  constructor(
    jsonapi: SingleResourceDoc,
    readonly name: string,
    readonly sourceCard: Card,
    readonly enclosingCard: Card,
    reader: CardReader,
    modules: ModuleLoader,
    container: Container
  ) {
    super(jsonapi, sourceCard.csRealm, sourceCard, reader, modules, container);
    if (typeof jsonapi.data.attributes?.csFieldArity === 'string') {
      this.csFieldArity = jsonapi.data.attributes?.csFieldArity === 'plural' ? 'plural' : 'singular';
    }
  }

  async isComputed(): Promise<boolean> {
    return await this.hasFeature('compute');
  }

  // when true, this field has its own special value type that is not a Card.
  // this will be true for all the "basic" built in field cards like
  // "integer-field" and "string-field".
  async isScalar(): Promise<boolean> {
    return await this.hasFeature('field-deserialize');
  }

  // TODO test this
  get isAdopted(): boolean {
    return !Object.keys(this.enclosingCard.csFields || {}).includes(this.name);
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
              this.sourceCard.canonicalURL
            } failed type validation for values: ${JSON.stringify(invalidItems)}`,
            { status: 400 }
          );
        }
        return;
      } else {
        if (!(await validate(value, this))) {
          throw new CardstackError(
            `field ${this.name} on card ${
              this.sourceCard.canonicalURL
            } failed type validation for value: ${JSON.stringify(value)}`,
            { status: 400 }
          );
        }
        return;
      }
    }

    if (this.csFieldArity === 'plural' && Array.isArray(value)) {
      if (value.some(i => i.id == null)) {
        throw new CardstackError(
          `Cannot set field '${this.name}' of card ${this.sourceCard.canonicalURL} with non-addressable cards. Fields with arity > 1 can only be set with addressable cards.`,
          { status: 400 }
        );
      }
      await Promise.all(
        value.map(async v => {
          let id: string = v.id;
          let oldValueRawData = Array.isArray(priorFieldValue) ? priorFieldValue.find(i => i.id === id) : null;
          let oldValueCard = oldValueRawData != null ? await this.patch({ data: oldValueRawData }) : null;
          let newValueCard = await this.patch({ data: v });
          await newValueCard.validate(oldValueCard, realm);
        })
      );
    } else {
      let newValueCard = await this.patch({ data: value });
      let oldValueCard = await this.patch({ data: priorFieldValue });
      await newValueCard.validate(oldValueCard, realm);
    }
  }

  async validateReference(
    _priorReferenceOrReferences: CardId | CardId[] | null,
    newReferenceOrReferences: CardId | CardId[] | null,
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
        let referencedCard = await this.reader.get(newRef); // let a 404 error be thrown when not found
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
          `field ${this.name} on card ${this.sourceCard.canonicalURL} failed card-type validation for reference: ${
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
    return await this.patch({ data: value });
  }

  async patch(otherDoc: SingleResourceDoc): Promise<FieldCard> {
    let newDoc = await this.patchDoc(
      merge((await this.asUpstreamDoc()).jsonapi, {
        data: { attributes: { csRealm: this.csRealm } },
      }),
      otherDoc
    );
    return await this.container.instantiate(
      FieldCard,
      newDoc,
      this.name,
      this.sourceCard,
      this.enclosingCard,
      this.reader,
      this.modules,
      this.container
    );
  }
}

export class AddressableCard extends Card implements CardId {
  // these are non-null because of the assertion in our construction that
  // ensures csId is present.
  readonly csId!: string;
  readonly upstreamId!: NonNullable<Card['upstreamId']>;

  constructor(
    jsonapi: SingleResourceDoc,
    reader: CardReader,
    modules: ModuleLoader,
    container: Container,
    identity?: CardId
  ) {
    let actualRealm = identity?.csRealm ?? jsonapi.data.attributes?.csRealm;
    if (typeof actualRealm !== 'string') {
      throw new CardstackError(`card missing required attribute "csRealm": ${JSON.stringify(jsonapi)}`);
    }
    if (identity != null) {
      if (jsonapi.data.attributes == null) {
        jsonapi.data.attributes = Object.create(null);
      }
      jsonapi.data.attributes!.csOriginalRealm = identity.csOriginalRealm ?? identity?.csRealm;
      jsonapi.data.attributes!.csId = identity.csId;
    }

    super(jsonapi, actualRealm, undefined, reader, modules, container);

    if ((this as any).csId == null) {
      throw new Error(`Bug: tried to use an UnsavedCard as a Card`);
    }
  }

  async patch(otherDoc: SingleResourceDoc): Promise<AddressableCard> {
    let newDoc = await this.patchDoc(
      merge((await this.asUpstreamDoc()).jsonapi, { data: { attributes: { csRealm: this.csRealm } } }),
      otherDoc
    );
    return await this.container.instantiate(AddressableCard, newDoc, this.reader, this.modules, this.container);
  }

  get canonicalURL(): string {
    return canonicalURL(this);
  }
}

interface CardValue {
  id?: string;
  attributes?: AttributesObject;
  relationships?: RelationshipsObject;
}

interface CardFiles {
  [filename: string]: string | CardFiles;
}

type FieldOrder = string[];

interface PeerDependencies {
  [packageName: string]: string;
}
type RawData = { ref: CardId | CardId[] | null } | { value: any } | null;

function assertFieldOrder(order: any): asserts order is FieldOrder {
  if (!Array.isArray(order)) {
    throw new Error(`csFieldOrder must be an array`);
  }
  if (order.find(i => typeof i !== 'string')) {
    throw new Error(`csFieldOrder cannot contain a non-string item`);
  }
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

function assertFeatures(features: any): asserts features is Card['csFeatures'] {
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

function relationshipToCardId(ref: RelationshipObject): CardId | CardId[] | null {
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
  return null;
}

function mergeRules(rules: OcclusionRules[]): OcclusionRules {
  if (rules.length === 0) {
    throw new Error(`bug: this should never happen`);
  }
  if (rules.length === 1) {
    return rules[0];
  }
  if (rules.slice(1).every(rule => isEqual(rule, rules[0]))) {
    return rules[0];
  }
  // to implement correctly, mergeRules will need to become a method on Card
  // because it needs to run `this.fieldSet()` to expand field sets into
  // individual fields.
  throw new Error(`mergeRules: unimplemented`);
}
