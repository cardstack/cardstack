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
import isObjectLike from 'lodash/isObjectLike';
import * as J from 'json-typescript';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import {
  OcclusionFieldSets,
  InnerOcclusionRules,
  assertOcclusionFieldSets,
  OcclusionRulesOrDefaults,
  InnerOcclusionRulesOrDefaults,
  Format,
} from './occlusion-rules';
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

let nonce = 0;

const nonJSFileExtenstions = Object.freeze(['css']);
export const apiPrefix = '/api';

export async function makeCollection(
  cards: AddressableCard[],
  meta: ResponseMeta,
  rules?: OcclusionRulesOrDefaults
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

  // if this card is stored inside another, this is the other
  readonly enclosingCard: Card | undefined;

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
    enclosingCard: Card | undefined,
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

    this.enclosingCard = enclosingCard;
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

  private rawData(fieldName: string): RawData {
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
        return await Promise.all(refs.map(ref => this.reader.get(ref)));
      } else if (refs != null) {
        return await this.reader.get(refs);
      }
    }
  }

  @Memoize()
  async field(name: string): Promise<FieldCard> {
    if (this.csFields) {
      if (name in this.csFields) {
        return await this.container.instantiate(
          FieldCard,
          merge({ data: { type: 'cards' } }, { data: this.csFields[name] }),
          name,
          this,
          this.reader,
          this.modules,
          this.container
        );
      }
    }
    let parent = await this.adoptsFrom();
    if (parent) {
      return await parent.field(name);
    } else {
      throw new CardstackError(`no such field "${name}"`, { status: 400 });
    }
  }

  // TODO needs testing!
  @Memoize()
  async fields(): Promise<FieldCard[]> {
    let fields: FieldCard[] = [];
    let card: Card | undefined = this;
    while (card) {
      if (card.csFields) {
        for (let [name, value] of Object.entries(card.csFields)) {
          fields.push(
            await this.container.instantiate(
              FieldCard,
              merge({ data: { type: 'cards' } }, { data: value }),
              name,
              this,
              this.reader,
              this.modules,
              this.container
            )
          );
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

  @Memoize()
  private async fieldSet(format: Format): Promise<Map<string, InnerOcclusionRules | true>> {
    let fieldSet: Map<string, InnerOcclusionRules | true> = new Map();
    if (this.csFieldSets?.[format]) {
      for (let fieldRule of this.csFieldSets[format]) {
        if (typeof fieldRule === 'string') {
          fieldSet.set(fieldRule, true);
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

  private async serialize(
    rules: OcclusionRulesOrDefaults,
    included: Map<string, OcclusionRulesOrDefaults[]>
  ): Promise<ResourceObject> {
    let data = Object.create(null);

    if (this instanceof AddressableCard) {
      data.id = this.canonicalURL;
    }

    data.type = 'cards';
    data.attributes = Object.create(null);
    data.attributes.csRealm = this.csRealm;

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
    if (this.csPeerDependencies) {
      data.attributes.csPeerDependencies = this.csPeerDependencies;
    }
    if (this.csFieldSets) {
      data.attributes.csFieldSets = this.csFieldSets;
    }

    data.relationships = Object.create(null);
    let adoptsFrom = await this.adoptsFrom();
    if (adoptsFrom) {
      data.relationships.csAdoptsFrom = {
        data: {
          type: 'cards',
          id: adoptsFrom.canonicalURL,
        },
      };
    }

    for (let field of ['csAdoptsFrom', ...this.fieldsWithData()]) {
      let rawData = this.rawData(field);
      if (!rawData) {
        continue;
      }
      if ('value' in rawData) {
        await this.applyRulesForAttribute(data.attributes, field, rules, rawData.value, included);
      } else {
        await this.applyRulesForRelationship(data.relationships, field, rules, rawData.ref, included);
      }
    }

    if (this.meta) {
      data.meta = this.meta;
    }

    return data;
  }

  private async serializeIncluded(included: Map<string, OcclusionRulesOrDefaults[]>): Promise<ResourceObject[]> {
    let resources: ResourceObject[] = [];
    while (true) {
      let foundMoreIncluded = new Map<string, OcclusionRulesOrDefaults[]>();
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
    field: string,
    rules: OcclusionRulesOrDefaults,
    data: any,
    included: Map<string, OcclusionRulesOrDefaults[]>
  ): Promise<void> {
    let includeFields = await this.includeFieldsForField(rules, field);
    if (includeFields === 'everything' || includeFields === 'upstream') {
      attributes[field] = cloneDeep(data);
    } else if (rules) {
      if (!includeFields.length) {
        return;
      }
      if (includeFields.find(i => i.name === field) && !isObjectLike(data)) {
        attributes[field] = data;
        return;
      }

      let interiorIncludeFields = flatten(
        typeof includeFields !== 'string' ? includeFields.map(i => i.includeFields || []) : []
      );
      let interiorRule: OcclusionRulesOrDefaults =
        typeof includeFields !== 'string' ? { includeFields: interiorIncludeFields } : includeFields;
      setInteriorCardFieldSet(rules, interiorRule);

      if (Array.isArray(data)) {
        attributes[field] = await Promise.all(
          data.map(async cardValue => {
            let interiorCard = await this.container.instantiate(
              Card,
              { data: cardValue },
              this.csRealm,
              this,
              this.reader,
              this.modules,
              this.container
            );
            return (await interiorCard.asInteriorCard(interiorRule, included)) as J.Value;
          })
        );
      } else {
        let interiorCard = await this.container.instantiate(
          Card,
          { data },
          this.csRealm,
          this,
          this.reader,
          this.modules,
          this.container
        );
        attributes[field] = (await interiorCard.asInteriorCard(interiorRule, included)) as J.Value;
      }
    }
  }

  private async applyRulesForRelationship(
    relationships: RelationshipsObject,
    field: string,
    rules: OcclusionRulesOrDefaults,
    reference: CardId | CardId[] | undefined,
    included: Map<string, OcclusionRulesOrDefaults[]>
  ): Promise<void> {
    let includeFields = await this.includeFieldsForField(rules, field);
    if (includeFields === 'everything' || includeFields === 'upstream' || includeFields.length) {
      if (Array.isArray(reference)) {
        relationships[field] = {
          data: reference.map(id => ({ type: 'cards', id: canonicalURL(id) })),
        };
      } else if (reference) {
        relationships[field] = {
          data: { type: 'cards', id: canonicalURL(reference) },
        };
      } else {
        relationships[field] = { data: null };
      }
    }

    if (!reference) {
      return;
    }

    if (includeFields === 'upstream') {
      // how to handle situation where the upstream doc provided to the Card
      // constuctor had included? is it our responsibility to mirror any
      // supplied included resources to the Card constuctor in the
      // asUpstream() response?
      return;
    }
    let interiorIncludeFields = flatten(
      typeof includeFields !== 'string' ? includeFields.map(i => i.includeFields || []) : []
    );
    let relationshipRule: OcclusionRulesOrDefaults =
      typeof includeFields !== 'string' ? { includeFields: interiorIncludeFields } : includeFields;
    setInteriorCardFieldSet(rules, relationshipRule);

    if (includeFields === 'everything' || includeFields.length) {
      if (Array.isArray(reference)) {
        for (let id of reference) {
          let includedRules = included.get(canonicalURL(id)) || [];
          includedRules.push(relationshipRule);
          included.set(canonicalURL(id), includedRules);
        }
      } else {
        let includedRules = included.get(canonicalURL(reference)) || [];
        includedRules.push(relationshipRule);
        included.set(canonicalURL(reference), includedRules);
      }
    }
  }

  private async includeFieldsForField(
    rules: OcclusionRulesOrDefaults,
    field: string
  ): Promise<InnerOcclusionRulesOrDefaults> {
    let includeFields: InnerOcclusionRules[] = [];
    if (rules === 'everything') {
      return 'everything';
    }
    if (rules === 'upstream') {
      return 'upstream';
    }

    if (rules.includeFieldSet) {
      let fieldSetRules = (await this.fieldSet(rules.includeFieldSet)).get(field);
      if (fieldSetRules) {
        includeFields.push(fieldSetRules === true ? { name: field } : fieldSetRules);
      }
    }
    includeFields = [
      ...includeFields,
      ...((rules.includeFields || []).filter(i => typeof i !== 'string' && i.name === field) as InnerOcclusionRules[]),
    ];
    if (rules.includeFields?.includes(field)) {
      includeFields.push({ name: field });
    }
    return includeFields;
  }

  private async asInteriorCard(
    rules: OcclusionRulesOrDefaults = 'everything',
    includedMap: Map<string, OcclusionRulesOrDefaults[]>
  ): Promise<CardValue> {
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
  async serializeAsJsonAPIDoc(rules: OcclusionRulesOrDefaults = 'everything'): Promise<SingleResourceDoc> {
    let includedMap = new Map<string, OcclusionRulesOrDefaults[]>();
    let data = await this.serialize(rules, includedMap);
    let jsonapi: SingleResourceDoc = { data };
    let included = (await this.serializeIncluded(includedMap)).filter(i => i.id !== this.canonicalURL);
    if (included.length) {
      jsonapi.included = included;
    }
    return jsonapi;
  }

  async asUpstreamDoc(): Promise<UpstreamDocument> {
    return new UpstreamDocument(await this.serializeAsJsonAPIDoc('upstream'));
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
    let newDoc = await this.patchDoc((await this.asUpstreamDoc()).jsonapi, otherDoc);
    return await this.container.instantiate(
      Card,
      newDoc,
      this.csRealm,
      this.enclosingCard,
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

    // this cast is safe because:
    //   1. Our constructor asserted that relationships.csAdoptsFrom was
    //      singular, not plural.
    //   2. There's no way to customize the FieldCard for csAdoptsFrom to
    //      provide an alternative deserialize() hook.
    let card = (await this.value('csAdoptsFrom')) as AddressableCard | null;
    if (card) {
      return card;
    }

    return await this.reader.get({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' });
  }

  get adoptsFromId(): CardId | undefined {
    let baseCardURL = canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'base' });
    if (this.canonicalURL === baseCardURL) {
      // base card has no parent
      return undefined;
    }
    let data = this.rawData('csAdoptsFrom');
    if (data && 'ref' in data && !Array.isArray(data.ref)) {
      return data.ref;
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

  async loadFeature(featureName: 'writer'): Promise<WriterFactory | null>;
  async loadFeature(featureName: 'indexer'): Promise<IndexerFactory<J.Value> | null>;
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
    let newDoc = await this.patchDoc((await this.asUpstreamDoc()).jsonapi, patch);
    return await this.cardInstantiator.instantiate(newDoc);
  }
}

export class FieldCard extends Card {
  readonly enclosingCard: Card;
  readonly csFieldArity: FieldArity = 'singular';

  constructor(
    jsonapi: SingleResourceDoc,
    readonly name: string,
    enclosingCard: Card,
    reader: CardReader,
    modules: ModuleLoader,
    container: Container
  ) {
    super(jsonapi, enclosingCard.csRealm, enclosingCard, reader, modules, container);
    this.enclosingCard = enclosingCard;
    if (typeof jsonapi.data.attributes?.csFieldArity === 'string') {
      this.csFieldArity = jsonapi.data.attributes?.csFieldArity === 'plural' ? 'plural' : 'singular';
    }
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
      if (value.some(i => i.id == null)) {
        throw new CardstackError(
          `Cannot set field '${this.name}' of card ${this.enclosingCard.canonicalURL} with non-addressable cards. Fields with arity > 1 can only be set with addressable cards.`,
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
    return await this.patch({ data: value });
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
    let newDoc = await this.patchDoc((await this.asUpstreamDoc()).jsonapi, otherDoc);
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
interface PeerDependencies {
  [packageName: string]: string;
}
type RawData = { ref: CardId | CardId[] | undefined } | { value: any } | null;

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

function mergeRules(rules: OcclusionRulesOrDefaults[]): OcclusionRulesOrDefaults {
  if (rules.length === 0) {
    throw new Error(`bug: this should never happen`);
  }
  if (rules.length === 1) {
    return rules[0];
  }
  if (rules.find(i => i === 'everything')) {
    return 'everything';
  }
  throw new Error(`unimplemented: mergeRules`);
}

// need to run this by Ed, this assumes that all interior cards will return
// embedded field sets if the outer card was requested with a fieldset.
function setInteriorCardFieldSet(rules: OcclusionRulesOrDefaults, interiorCardRules: OcclusionRulesOrDefaults): void {
  if (
    typeof rules === 'object' &&
    rules.includeFieldSet &&
    interiorCardRules !== 'everything' &&
    interiorCardRules !== 'upstream'
  ) {
    interiorCardRules.includeFieldSet = 'embedded';
  }
}
