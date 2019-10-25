import Error from '@cardstack/plugin-utils/error';
import Session from '@cardstack/plugin-utils/session';
import { todo } from '@cardstack/plugin-utils/todo-any';
import {
  SingleResourceDoc,
  ResourceObject,
  ResourceIdentifierObject,
  CollectionResourceDoc,
  AttributesObject,
  RelationshipsObject,
  RelationshipsWithData,
  ResourceLinkage
} from "jsonapi-typescript";
import {
  set,
  get,
  uniq,
  uniqBy,
  isEqual,
  sortBy,
  cloneDeep,
  unset,
  differenceBy
} from 'lodash';
import logger from '@cardstack/logger';
import { join } from "path";
import { tmpdir } from 'os';
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  removeSync,
  writeJSONSync,
  readJSONSync
} from "fs-extra";

const cardsDir: string = join(tmpdir(), 'card_modules');
const cardFileName = 'card.js';
const seenVersionsFile = '.seen_versions.json';
const log = logger('cardstack/card-utils');

interface CardContext {
  repository?: string;
  packageName?: string;
  cardId?: string;
  modelId?: string;
}

// TODO we should create an internal card format type and an external card format type
// to make things a bit more clear.

const cardIdDelim = '::';
const cardBrowserAssetFields = [
  'isolated-template',
  'isolated-js',
  'isolated-css',
  'embedded-template',
  'embedded-js',
  'embedded-css',
];
const metadataFieldTypesField = 'metadata-field-types';
const embeddedMetadataFieldTypesField = 'embedded-metadata-field-types';

function cardContextFromId(id: string | number) {
  let noContext: CardContext = {};
  if (id == null) { return noContext; }

  let idSplit = String(id).split(cardIdDelim);
  if (idSplit.length < 2) { return noContext; }

  let [repository, packageName, cardId, modelId] = idSplit;

  return {
    repository,
    packageName,
    cardId,
    modelId,
  };
}

function cardContextToId({ repository, packageName, cardId, modelId }: CardContext) {
  return [repository, packageName, cardId, modelId].filter(i => i != null).join(cardIdDelim);
}

function isCard(type: string = '', id: string = '') {
  return id && type === id && id.split(cardIdDelim).length > 2;
}

async function loadCard(schema: todo, internalCard: SingleResourceDoc, getInternalCard: todo) {

  // a searcher or indexer may be returning invalid cards, so we
  // need to make sure to validate the internal card format.
  await validateInternalCardFormat(schema, internalCard, getInternalCard);

  await generateCardModule(internalCard);
  return await getCardSchemas(schema, internalCard, getInternalCard);
}

function getCardId(id: string | number | undefined) {
  if (id == null) { return; }
  if (String(id).split(cardIdDelim).length < 3) { return; }
  let { repository, packageName, cardId } = cardContextFromId(id);
  return cardContextToId({ repository, packageName, cardId });
}

async function validateInternalCardFormat(schema: todo, internalCard: SingleResourceDoc, getInteralCard: todo) {
  let id = internalCard.data.id as string;
  let type = internalCard.data.type as string;
  if (!id) { throw new Error(`The card ID must be supplied in the card document`, { status: 400, source: { pointer: '/data/id' }}); }
  if (!type) { throw new Error(`The card type must be supplied in the card document`, { status: 400, source: { pointer: '/data/type' }}); }

  if (id !== type) { throw new Error(`The card '${id}' has a card model content-type that does not match its id: '${type}'`, { status: 400, source: { pointer: '/data/id'}}); }

  let fields: ResourceIdentifierObject[] = get(internalCard, 'data.relationships.fields.data') || [];
  let foreignFieldIndex = fields.findIndex(i => !(i.id.includes(id)));
  if (foreignFieldIndex > -1 ) { throw new Error(`The card '${id}' uses a foreign field '${fields[foreignFieldIndex].type}/${fields[foreignFieldIndex].id}`, { status: 400, source: { pointer: `/data/relationships/fields/data/${foreignFieldIndex}`}}); }

  let modelRelationships: string[] = Object.keys(get(internalCard, 'data.relationships') || {}).filter(i => i !== 'fields');
  for (let rel of modelRelationships) {
    let linkage: ResourceLinkage = get(internalCard, `data.relationships.${rel}.data`);
    if (!linkage) { continue; }
    if (Array.isArray(linkage)) {
      let foreignLinkageIndex = linkage.findIndex(i => !isCard(i.type, i.id) && ((!schema.isSchemaType(i.type) && !i.type.includes(id)) || !i.id.includes(id)));
      if (foreignLinkageIndex > -1) {
        throw new Error(`The card '${id}' has a relationship to a foreign internal model '${linkage[foreignLinkageIndex].type}/${linkage[foreignLinkageIndex].id}'`, { status: 400, source: { pointer: `/data/relationships/${rel}/data/${foreignLinkageIndex}`}});
      }
    } else {
      if (!isCard(linkage.type, linkage.id) && ((!schema.isSchemaType(linkage.type) && !linkage.type.includes(id)) || !linkage.id.includes(id))) {
        throw new Error(`The card '${id}' has a relationship to a foreign internal model '${linkage.type}/${linkage.id}'`, { status: 400, source: { pointer: `/data/relationships/${rel}/data`}});
      }
    }
  }

  // TODO need validation for included with missing id?
  if (!internalCard.included) { return; }

  let chain = await adoptionChain(internalCard, getInteralCard);

  let foreignIncludedIndex = (internalCard.included || []).findIndex(i =>
    !isCard(i.type, i.id) &&
    i.id != null && (
      (!schema.isSchemaType(i.type) && !i.type.includes(id)) ||
      (
        !i.id.includes(id) &&
        !chain.some(aid => i.id != null && i.id.includes(aid))
      )
    )
  );

  if (foreignIncludedIndex > -1 ) {
    throw new Error(`The card '${id}' contains included foreign internal models '${internalCard.included[foreignIncludedIndex].type}/${internalCard.included[foreignIncludedIndex].id}`, { status: 400, source: { pointer: `/included/${foreignIncludedIndex}`}});
  }
}

async function adoptionChain(internalCard: SingleResourceDoc, getInteralCard: todo) {
  let adoptedFromId;
  let currentCard = internalCard;
  let chain = [];

  while (adoptedFromId = get(currentCard, 'data.relationships.adopted-from.data.id')) { // eslint-disable-line no-cond-assign
    chain.push(adoptedFromId);
    currentCard = await getInteralCard(adoptedFromId);
  }
  return chain;
}

function validateExternalCardFormat(externalCard: SingleResourceDoc) {
  let id = externalCard.data.id as string;
  if (!id) {
    throw new Error(`The card ID must be supplied in the card document`, { status: 400, source: { pointer: '/data/id' } });
  }
  if (externalCard.data.type !== 'cards') {
    throw new Error(`The document type for card '${id}' is not 'cards', rather it is '${externalCard.data.type}'`, { status: 400, source: { pointer: '/data/type' } });
  }

  let modelLinkage: ResourceIdentifierObject = get(externalCard, 'data.relationships.model.data');
  if (!modelLinkage) {
    throw new Error(`The card 'cards/${id}' is missing its card model '${id}/${id}'.`, { status: 400, source: { pointer: '/data/relationships/model/data' } });
  }

  if (modelLinkage.type !== id || modelLinkage.id !== id) {
    throw new Error(`For the card '${id}', the card model does not match the card id. The card model is '${modelLinkage.type}/${modelLinkage.id}'`, { status: 400, source: { pointer: '/data/relationships/model/data' } });
  }
  if (!(externalCard.included || []).find(i => `${i.type}/${i.id}` === `${id}/${id}`)) {
    throw new Error(`The specified card model '${id}/${id}' is missing for card '${id}'`, { status: 400, source: { pointer: '/data/relationships/model/data' } });
  }
}

async function generateInternalCardFormat(schema: todo, externalCard: SingleResourceDoc, cardServices: todo) {
  let id = externalCard.data.id as string;
  if (!id) { throw new Error(`The card ID must be supplied in the card document in order to create the card.`); }

  validateExternalCardFormat(externalCard);

  externalCard = await addCardNamespacing(schema, externalCard, cardServices) as SingleResourceDoc;
  let model: ResourceObject | undefined = (externalCard.included || []).find(i => `${i.type}/${i.id}` === `${id}/${id}`);
  if (!model) { throw new Error(`The card 'cards/${id}' is missing its card model '${id}/${id}'.`, { status: 400, source: { pointer: '/data/relationships/model/data' }}); }

  let fields: ResourceIdentifierObject[] = get(externalCard, 'data.relationships.fields.data') || [];
  set(model, 'relationships.fields.data', fields);
  let version = get(externalCard, 'data.meta.version');

  let adoptedCardId: string = get(externalCard, 'data.relationships.adopted-from.data.id');
  if (adoptedCardId) {
    set(model, 'relationships.adopted-from.data', { type: adoptedCardId, id: adoptedCardId });
  }

  if (version != null) {
    set(model, 'meta.version', version);
  }
  for (let field of cardBrowserAssetFields.concat([metadataFieldTypesField])) {
    let value = get(externalCard, `data.attributes.${field}`) as string;
    if (!value) { continue; }
    set(model, `attributes.${field}`, value);
  }

  let nonModelCardResources = cloneDeep((externalCard.included || [])
    .filter(i => model &&
      `${i.type}/${i.id}` !== `${model.type}/${model.id}` &&
      (i.id || '').includes(id)));

  for (let resource of nonModelCardResources.concat(model)) {
    if (!resource.id) { continue; }
    if (resource.type === 'cards') {
      resource.type = resource.id;
    }
    for (let rel of Object.keys(resource.relationships || {})) {
      let linkage: ResourceLinkage = get(resource, `relationships.${rel}.data`);
      if (Array.isArray(linkage)) {
        set(resource, `relationships.${rel}.data`,
          (linkage as ResourceIdentifierObject[]).map(i => i.type === 'cards' ? { type: i.id, id: i.id } : { type: i.type, id: i.id })
        );
      } else if (linkage) {
        set(resource, `relationships.${rel}.data`,
          linkage.type === 'cards' ? { type: linkage.id, id: linkage.id } : { type: linkage.type, id: linkage.id }
        );
      }
    }
  }

  // console.log('model-is', JSON.stringify(model, null, 2));

  return { data: model, included: nonModelCardResources };
}

// TODO it's possible for cards originating from the same package to have different templates/components
// as a specific card instance could have its schema altered. need to think through how we would represent
// cards that have different components/templates but originate from the same package, or cards
// from the same package but different repositories that have been altered between the different repos.
// Ideally we can leverage the "card adoption" to make simplifying assumptions around cards that share
// similar components/templates, but will also need to be flexible enough to disambiguate cards that have
// differing components/templates that originate from the same package.
async function generateCardModule(internalCard: SingleResourceDoc) {
  if (!internalCard || !internalCard.data || !internalCard.data.id) { return; }

  let { repository, packageName } = cardContextFromId(internalCard.data.id);
  if (!repository || !packageName) { return; }

  let cleanCard: SingleResourceDoc = {
    data: cloneDeep(internalCard.data),
    included: sortBy(internalCard.included, i => `${i.type}/${i.id}`)
  };
  let computedFields = ((get(cleanCard, 'data.relationships.fields.data') || []) as ResourceIdentifierObject[])
    .filter(i => i.type === 'computed-fields').map(i => i.id);
  for (let field of Object.keys(cleanCard.data.attributes || {})) {
    if (!computedFields.includes(field) || !cleanCard.data.attributes) { continue; }
    delete cleanCard.data.attributes[field];
  }
  for (let field of Object.keys(cleanCard.data.relationships || {})) {
    if (!computedFields.includes(field) || !cleanCard.data.relationships) { continue; }
    delete cleanCard.data.relationships[field];
  }
  unset(cleanCard, 'data.attributes.metadata-field-types');
  unset(cleanCard, 'data.attributes.embedded-metadata-field-types');
  let version: string = get(cleanCard, 'data.meta.version');
  let cardFolder: string = join(cardsDir, repository, packageName);
  let cardFile: string = join(cardFolder, cardFileName);
  let seenVersions: string[] = [];
  ensureDirSync(cardFolder);
  delete cleanCard.data.meta;

  // need to make sure we aren't using cached card module since we use
  // import to load the card.
  if (pathExistsSync(cardFile)) {
    for (let cacheKey of Object.keys(require.cache)) {
      if (!cacheKey.includes(cardFile)) { continue; }
      delete require.cache[cacheKey];
    }
    let cardOnDisk: SingleResourceDoc = (await import(cardFile)).default;
    // cleanup default value field artifacts
    for (let field of Object.keys(cardOnDisk.data.attributes || {})) {
      if (cardOnDisk.data.attributes && cardOnDisk.data.attributes[field] == null) {
        delete cardOnDisk.data.attributes[field];
      }
    }
    for (let field of Object.keys(cleanCard.data.attributes || {})) {
      if (cleanCard.data.attributes && cleanCard.data.attributes[field] == null) {
        delete cleanCard.data.attributes[field];
      }
    }
    if (isEqual(cleanCard.data, cardOnDisk.data)) { return; }

    try {
      seenVersions = readJSONSync(join(cardFolder, seenVersionsFile));
    } catch(e) {
      if (e.code !== 'ENOENT') { throw e; } // ignore file not found errors
    }
    // the PendingChange class will actually create DocumentContext for the old
    // and new versions of the document when it is being updated, and we dont want
    // to inadvertantly clobber the latest card on disk with an older version of
    // the card as a result of processing an older card as part of what PendingChange
    // needs to do, so we keep track of the versions of the card that we've seen and
    // only write to disk if the version of the card is not one we have encountered yet.
    if (version != null && seenVersions.includes(version)) { return; }
  }

  log.info(`generating on-disk card artifacts for cards/${internalCard.data.id} in ${cardFolder}`);

  createPkgFile(cleanCard, cardFolder);
  createBrowserAssets(cleanCard, cardFolder);

  // TODO link peer deps and create entry points.
  // I'm punting on this for now, as custom card components are not a
  // top priority at the moment. Linking peer deps and creating
  // entry points makes assumptions around a shared file system between
  // ember-cli's node and the hub, as well as it requires that the cardhost
  // ember-cli build actually occur before this function is called (in
  // order to link peer deps), as we leverage the embroider app dir from
  // the build in order to link peer deps. For the node-tests this will
  // be a bit tricky. I think the easiest thing would be to mock an
  // ember-cli build of the card host for node-tests by creating an
  // .embroider-build-path file that just points to the root project
  // folder (which would be the parent of the yarn workspace's
  // node_modules folder).

  // TODO in the future `yarn install` this package
  writeFileSync(cardFile, `module.exports = ${JSON.stringify(cleanCard, null, 2)};`, 'utf8');
  if (version != null) {
    seenVersions.push(version);
    writeJSONSync(join(cardFolder, seenVersionsFile), seenVersions);
  }

  // TODO in the future we should await until webpack finishes compiling
  // the browser assets however we determine to manage that...
}

function createBrowserAssets(internalCard: SingleResourceDoc, cardFolder: string) {
  if (!internalCard.data.attributes) { return; }

  for (let field of cardBrowserAssetFields) {
    let content: string = internalCard.data.attributes[field] as string;
    content = (content || '').trim();
    let [ assetType, extension ] = field.split('-');
    extension = extension === 'template' ? 'hbs' : extension;
    let file = join(cardFolder, `${assetType}.${extension}`);
    if (!content) {
      log.debug(`ensuring browser asset doesn't exist for cards/${internalCard.data.id} at ${file}`);
      removeSync(file);
    } else {
      log.debug(`generating browser asset for cards/${internalCard.data.id} at ${file}`);
      writeFileSync(file, content, 'utf8');
    }
  }
}

function createPkgFile(internalCard: SingleResourceDoc, cardFolder: string) {
  if (!internalCard.data.id) { return; }

  let { packageName:name } = cardContextFromId(internalCard.data.id);
  let version = '0.0.0'; // TODO deal with version numbers

  log.debug(`generating package.json for cards/${internalCard.data.id} at ${join(cardFolder, 'package.json')}`);
  let pkg: todo = {
    name,
    version,
    // TODO grab peer deps from the card document instead of hard coding here
    "peerDependencies": {
      "@glimmer/component": "*"
    }
  };
  writeFileSync(join(cardFolder, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
  return pkg;
}

async function getCardSchemas(schema: todo, cardInInternalOrExternalFormat: SingleResourceDoc, getInternalCard?: todo) {
  if (!cardInInternalOrExternalFormat) { return; }
  if (!cardInInternalOrExternalFormat.data.id) { return; }

  let schemaModels: ResourceObject[] = [];

  for (let resource of (cardInInternalOrExternalFormat.included || [])) {
    if (!schema.isSchemaType(resource.type)) { continue; }
    schemaModels.push(resource);
  }
  let { contentType: cardModelSchema, adoptedCard } = await deriveCardModelContentType(cardInInternalOrExternalFormat, getInternalCard);
  if (cardModelSchema) {
    schemaModels.push(cardModelSchema);
  }

  if (adoptedCard && adoptedCard.included) {
    schemaModels = schemaModels.concat(adoptedCard.included.filter((i: ResourceObject) => schema.isSchemaType(i.type)));
  }

  return schemaModels;
}

async function deriveCardModelContentType(cardInInternalOrExternalFormat: SingleResourceDoc, getInternalCard?: todo) {
  if (!cardInInternalOrExternalFormat.data.id) { return {}; }
  let id = getCardId(cardInInternalOrExternalFormat.data.id);

  let fields: RelationshipsWithData = {
    // add here fields from adopted card
    // maybe internal session here
    // combine fields, e.g. unionBy, to keep adopted card
    // cardServices.get(session, cardId)
    data: [
      { type: 'fields', id: 'fields' },
      { type: 'fields', id: 'adopted-from' }
    ].concat(
      cardBrowserAssetFields.map(i => ({ type: 'fields', id: i })),
      get(cardInInternalOrExternalFormat, 'data.relationships.fields.data') || [],
      [
        { type: 'computed-fields', id: 'metadata-field-types' },
        { type: 'computed-fields', id: 'embedded-metadata-field-types' }
      ]
    )
  };

  // not checking field-type, as that precludes using computed relationships for meta
  // which should be allowed. this will result in adding attr fields here, but that should be harmless
  // get includes here so fields are included todo
  let defaultIncludes = [
    'fields',
    'fields.related-types',
    'fields.constraints',
    'adopted-from',
    'adopted-from.fields',
    'adopted-from.related-types',
    'adopted-from.constraints',
    // TODO move the adopted-from default includes into the traversable relationships...
    // 'adopted-from.adopted-from.adopted-from.adopted-from.adopted-from'...
  ];

  // We only need to ponder default includes when writing documents to the index, so that the
  // index has the correct default includes. when returning docs (aka running them through adaptToFormat)
  // there is no need to worry about default includes, as that will already have been taken into account.
  // The scnearios when you are writing to the index you'll always have a getInteralCard function.
  let adoptedCard: SingleResourceDoc | undefined;
  if (typeof getInternalCard === 'function') {
    let cards: SingleResourceDoc[] = [cardInInternalOrExternalFormat];

    let adoptedFromCardId = get(cardInInternalOrExternalFormat, 'data.relationships.adopted-from.data.id');
    if (adoptedFromCardId) {
      adoptedCard = await getInternalCard(adoptedFromCardId);
      if (adoptedCard) {
        cards.push(adoptedCard); // TODO this needs to include the recursive adopted card family
        if (fields && Array.isArray(fields.data)) {
          let adoptedFields = get(adoptedCard, 'data.relationships.fields.data') || [];
          fields.data = fields.data.concat(adoptedFields);
        }
      }
    }

    // TODO I think we can consolidate the reads of adopted cards to happen in the traversable relationships function
    // consider using that for all your adopted card reading needs...
    defaultIncludes = defaultIncludes.concat(await traversableRelationships(cards, getInternalCard, 'isolated'));
  }

  let modelContentType: ResourceObject = {
    id,
    type: 'content-types',
    attributes: { 'default-includes': uniq(defaultIncludes) },
    relationships: { fields }
  };
  return { contentType: modelContentType, adoptedCard };
}

async function traversableRelationships(internalCards: SingleResourceDoc[], getInternalCard: todo, format: string, allRelationships: string[] = [], parentRelationship: string = '') {
  for (let internalCard of internalCards) {
    let fields: ResourceIdentifierObject[] = (get(internalCard, 'data.relationships.fields.data') || [] as ResourceIdentifierObject[]).filter((i: ResourceIdentifierObject) => {
      let field = (internalCard.included || []).find(j => `${j.type}/${j.id}` === `${i.type}/${i.id}`);
      if (!field) { return; }
      return format === 'isolated' ||
        getCardId(field.id) === internalCard.data.id ||
        (get(field, 'attributes.needed-when-embedded'));
    });

    let recurse = async (cardId: string, field: string) => {
      let relatedCard: SingleResourceDoc | undefined;
      try {
        relatedCard = await getInternalCard(cardId);
      } catch (e) {
        if (e.status !== 404) { throw e; }
      }
      if (!relatedCard) { return; }
      // TODO work through how to recurse thru all the fields that the related card adopts
      await (traversableRelationships([ relatedCard ], getInternalCard, 'embedded', allRelationships, field));
    };

    for (let { id: field } of fields) {
      let linkage: ResourceLinkage = get(internalCard, `data.relationships.${field}.data`);
      if (!linkage) { continue; }
      allRelationships.push(parentRelationship ? `${parentRelationship}.${field}` : field);
      if (Array.isArray(linkage)) {
        for (let { id: relatedCardId } of linkage) {
          await recurse(relatedCardId, field);
        }
      } else if (linkage.id) {
        await recurse(linkage.id, field);
      }
    }
  }

  return uniq(allRelationships);
}
// Internal and external cards should have a type, even if they have the same structure, for ease of using
// external cards have the primary content type of the json-api resource of content-type card
// internal cards never have primary content type of type card - see isCard for example

// deals with cards exiting the system, so deals with external format
async function adaptCardCollectionToFormat(schema: todo, session: Session, internalCollection: CollectionResourceDoc, format: string, cardServices: todo) {
  let included: ResourceObject[] = [];
  let data: ResourceObject[] = [];
  for (let resource of internalCollection.data) {
    if (!isCard(resource.type, resource.id)) {
      data.push(resource);
      continue;
    }
    let { data:cardResource, included:cardIncluded = [] } = await adaptCardToFormat(schema, session, { data: resource, included: internalCollection.included }, format, cardServices);
    included = included.concat(cardIncluded);
    data.push(cardResource);
  }
  let rootItems = data.map(i => `${i.type}/${i.id}`);
  included = uniqBy(included.filter(i => !rootItems.includes(`${i.type}/${i.id}`)), j => `${j.type}/${j.id}`)
    .map(i => {
      if (isCard(i.type, i.id)) {
        i.type = 'cards';
      }
      return i;
    });
  let document: CollectionResourceDoc = { data };
  if (included.length) {
    document.included = included;
  }
  return document;
}

async function adaptCardToFormat(schema: todo, session: Session, internalCard: SingleResourceDoc, format: string, cardServices: todo) {
  if (!internalCard.data || !internalCard.data.id) { throw new Error(`Cannot load card with missing id.`); }

  let id = internalCard.data.id;
  internalCard.data.attributes = internalCard.data.attributes || {};

  // we need to make sure that grants don't interfere with our ability to get the card schema
  let priviledgedCard: SingleResourceDoc | undefined;
  if (session !== Session.INTERNAL_PRIVILEGED) {
    try {
      let card = await cardServices.get(Session.INTERNAL_PRIVILEGED, id, 'isolated');
      priviledgedCard = await generateInternalCardFormat(schema, card, cardServices);
    } catch (e) {
      if (e.status !== 404) { throw e; }
    }
  }
  priviledgedCard = priviledgedCard || internalCard;

  let priviledgedAdoptedCard: SingleResourceDoc | undefined;
  // TODO need recurse through the adopted relationships to get the family of adopted cards
  // TODO let's avoid having to read adopted cards out of the index by default including them (in fact I think we are already doing that)
  let adoptedCardId: string = get(internalCard, 'data.relationships.adopted-from.data.id');
  if (adoptedCardId) {
    try {
      let adoptedCard = await cardServices.get(Session.INTERNAL_PRIVILEGED, adoptedCardId, 'isolated');
      priviledgedAdoptedCard = await generateInternalCardFormat(schema, adoptedCard, cardServices);
    } catch (e) {
      if (e.status !== 404) { throw e; }
    }
  }

  let cardSchema = await getCardSchemas(schema, priviledgedCard) || [];
  schema = await schema.applyChanges(cardSchema.map(document => ({ id:document.id, type:document.type, document })));

  let result: SingleResourceDoc = {
    data: {
      id,
      type: 'cards',
      attributes: {},
      relationships: {
        fields: get(internalCard, 'data.relationships.fields'),
        'adopted-from': get(priviledgedCard, 'data.relationships.adopted-from'),
        model: {
          data: { type: internalCard.data.type, id: internalCard.data.id }
        }
      }
    },
    included: []
  };
  if (internalCard.data.meta) {
    result.data.meta = internalCard.data.meta;
  }

  let attributes: AttributesObject = {};
  for (let attr of Object.keys(get(priviledgedCard, 'data.attributes') || {})) {
    if (cardBrowserAssetFields.concat([metadataFieldTypesField]).includes(attr) && result.data.attributes) {
      result.data.attributes[attr] = get(priviledgedCard, `data.attributes.${attr}`);
    }
  }
  for (let attr of
    Object.keys(internalCard.data.attributes)
      .filter(i => !cardBrowserAssetFields.concat([
        metadataFieldTypesField,
        embeddedMetadataFieldTypesField
      ]).includes(i))) {
    attributes[attr] = internalCard.data.attributes[attr];
  }
  unset(attributes, metadataFieldTypesField);
  unset(attributes, embeddedMetadataFieldTypesField);
  let relationships: RelationshipsObject = {};
  for (let rel of Object.keys(internalCard.data.relationships || {})) {
    if (rel === 'fields' || !internalCard.data.relationships) { continue; }
    let linkage: ResourceLinkage = get(internalCard, `data.relationships.${rel}.data`);
    if (Array.isArray(linkage)) {
      relationships[rel] = {
        data: (linkage as ResourceIdentifierObject[]).map(i =>
          isCard(i.type, i.id) ? ({ type: 'cards', id: i.id }) : ({ type: i.type, id: i.id })
        )
      };
    } else if (linkage) {
      relationships[rel] = {
        data: isCard(linkage.type, linkage.id) ? ({ type: 'cards', id: linkage.id }) : ({ type: linkage.type, id: linkage.id })
      };
    }
  }
  let model: ResourceObject = {
    id,
    type: id,
    attributes,
    relationships
  };

  if (format === 'isolated') {
    result.included = [model].concat((internalCard.included || []).filter(i => schema.isSchemaType(i.type)));
    if (priviledgedAdoptedCard) {
      result.included = differenceBy(
        result.included || [],
        priviledgedAdoptedCard.included || [],
        (i: ResourceObject) => `${i.type}/${i.id}`
      );
    }
  }

  // TODO need to make sure this represents the entire graph of adopted cards' fields
  let allFields: ResourceIdentifierObject[] = (get(priviledgedCard, 'data.relationships.fields.data') || [])
    .concat(get(priviledgedAdoptedCard, 'data.relationships.fields.data') || []);
  for (let { id: fieldId } of allFields) {
    let isAdoptedField = id !== getCardId(fieldId);
    let { modelId: fieldName } = cardContextFromId(fieldId);
    if (!fieldName) { continue; }
    let field = schema.getRealAndComputedField(fieldId);

    if (formatHasField(field, format)) {
      let fieldAttrValue: todo = get(model, `attributes.${fieldId}`);
      let fieldRelValue: ResourceLinkage = get(model, `relationships.${fieldId}.data`);

      if (!field.isRelationship && fieldAttrValue !== undefined && result.data.attributes) {
        result.data.attributes[fieldName] = fieldAttrValue;
      } else if (field.isRelationship && fieldRelValue && result.data.relationships && result.included) {
        result.data.relationships[fieldName] = { data: cloneDeep(fieldRelValue) };
        let includedResources: ResourceObject[] = [];
        if (Array.isArray(fieldRelValue)) {
          if (isAdoptedField && fieldRelValue.some((i: ResourceIdentifierObject) => schema.isSchemaType(i.type))) { continue; } // cards are not responsible for including any adopted schema
          let relRefs = (fieldRelValue as ResourceIdentifierObject[]).map((i: ResourceIdentifierObject) => `${i.type}/${i.id}`);
          includedResources = internalCard.included ?
            internalCard.included.filter(i =>
              (isCard(i.type, i.id) ? relRefs.includes(`cards/${i.id}`) : relRefs.includes(`${i.type}/${i.id}`))
            ) : [];
        } else {
          if (isAdoptedField && schema.isSchemaType(fieldRelValue.type)) { continue; } // cards are not responsible for including any adopted schema
          let includedResource = internalCard.included && internalCard.included.find(i =>
            fieldRelValue != null &&
            !Array.isArray(fieldRelValue) &&
            `${i.type}/${i.id}` === `${fieldRelValue.type === 'cards' ? fieldRelValue.id : fieldRelValue.type}/${fieldRelValue.id}`);
          if (includedResource) {
            includedResources = [includedResource];
          }
        }
        let resolvedIncluded: ResourceObject[] = [];
        for (let resource of includedResources) {
          if (!resource.id) { continue; }
          if (!isCard(resource.type, resource.id)) {
            resolvedIncluded.push(resource);
          } else {
            resolvedIncluded.push(...crawlEmbeddedCards(internalCard, resource.id).map((included: ResourceObject) => {
              let embeddedFieldTypes = get(included, `attributes.${embeddedMetadataFieldTypesField}`);
              if (!embeddedFieldTypes) { return included; } // if this is the case you have already dealt with it--just move along

              set(included, `attributes.${metadataFieldTypesField}`, embeddedFieldTypes);
              unset(included, `attributes.${embeddedMetadataFieldTypesField}`);
              return included;
            }));
          }
        }

        result.included = result.included.concat(resolvedIncluded);
      }
    } else {
      unset(result, `data.attributes.${metadataFieldTypesField}.${fieldName}`);
    }
  }
  result.included = uniqBy(result.included, i => `${i.type}/${i.id}`);
  return removeCardNamespacing(result) as SingleResourceDoc;
}

function crawlEmbeddedCards(internalCard: SingleResourceDoc, embeddedCardId: string, embeddedCards: ResourceObject[] = []) {
  let embeddedCard = (internalCard.included || []).find(i => `${i.type}/${i.id}` === `${embeddedCardId}/${embeddedCardId}`);
  if (!embeddedCard) { return embeddedCards; }

  embeddedCards.push(embeddedCard);
  for (let relationship of Object.keys(embeddedCard.relationships || {})) {
    let linkage: ResourceLinkage = get(embeddedCard, `relationships.${relationship}.data`);
    if (!linkage) { continue; }
    if (Array.isArray(linkage)) {
      for (let ref of linkage) {
        if (!isCard(ref.type, ref.id)) { continue; }
        crawlEmbeddedCards(internalCard, ref.id, embeddedCards);
      }
    } else if (linkage.id) {
      if (!isCard(linkage.type, linkage.id)) { continue; }
      crawlEmbeddedCards(internalCard, linkage.id, embeddedCards);
    }
  }
  return uniqBy(embeddedCards, i => `${i.type}/${i.id}`);
}

function removeCardNamespacing(internalCard: SingleResourceDoc) {
  let id = internalCard.data.id as string;
  if (!id) { return; }

  let resultingCard = cloneDeep(internalCard) as SingleResourceDoc;
  for (let resource of [resultingCard.data].concat(resultingCard.included || [])) {
    if (resource.type !== 'cards' && !isCard(resource.type, resource.id)) {
      resource.type = getCardId(resource.type) ? cardContextFromId(resource.type).modelId as string : resource.type;
      resource.id = getCardId(resource.id) && resource.id != null ? cardContextFromId(resource.id).modelId as string : resource.id;
    }
    if (isCard(resource.type, resource.id) && resource.id !== id) {
      resource.type = 'cards';
    }
    for (let field of Object.keys(resource.attributes || {})) {
      if (cardBrowserAssetFields.concat([metadataFieldTypesField]).includes(field)) { continue; }
      let { modelId:fieldName } = cardContextFromId(field);
      if (!fieldName || !resource.attributes) { continue; }
      resource.attributes[fieldName] = resource.attributes[field];
      delete resource.attributes[field];
    }
    for (let field of Object.keys(resource.relationships || {})) {
      let { modelId:fieldName } = cardContextFromId(field);
      if (!resource.relationships ||
        (field === 'model' && resource.type === 'cards')) { continue; }
      if (fieldName) {
        resource.relationships[fieldName] = resource.relationships[field];
        delete resource.relationships[field];
      } else {
        fieldName = field;
      }
      let linkage: ResourceLinkage = get(resource, `relationships.${fieldName}.data`);
      if (Array.isArray(linkage)) {
        set(resource, `relationships.${fieldName}.data`, (linkage as ResourceIdentifierObject[]).map(i => {
          let linkageType: string = isCard(i.type, i.id) ? 'cards' : i.type;
          return {
            type: linkageType !== 'cards' && getCardId(linkageType) ? cardContextFromId(linkageType).modelId : linkageType,
            id: linkageType !== 'cards' && getCardId(i.id) ? cardContextFromId(i.id).modelId : i.id,
          };
        }));
      } else if (linkage) {
        let linkageType: string | undefined = isCard(linkage.type, linkage.id) ? 'cards' : linkage.type;
        linkageType = linkageType !== 'cards' && getCardId(linkageType) ? cardContextFromId(linkageType).modelId : linkageType;
        let linkageId = linkageType !== 'cards' && getCardId(linkage.id) ? cardContextFromId(linkage.id).modelId : linkage.id;
        set(resource, `relationships.${fieldName}.data`, { type: linkageType, id: linkageId });
      }
    }
  }

  return resultingCard;
}

async function addCardNamespacing(schema: todo, externalCard: SingleResourceDoc, cardServices: todo) {
  let id = getCardId(externalCard.data.id);
  if (!id) { return; }

  // TODO ultimately we need a recusive graph of the adopted card heirarchy--not just a single level
  let cards: SingleResourceDoc[] = [ externalCard ];
  let adoptedCardId: string = get(externalCard, 'data.relationships.adopted-from.data.id');
  if (adoptedCardId) {
    try {
      let adoptedCard: SingleResourceDoc = await cardServices.get(Session.INTERNAL_PRIVILEGED, adoptedCardId, 'isolated');
      cards.push(adoptedCard);
    } catch (e) {
      if (e.status !== 404) { throw e; }
    }
  }

  let resultingCard = cloneDeep(externalCard) as SingleResourceDoc;
  for (let resource of [resultingCard.data].concat(resultingCard.included || [])) {
    let isSchemaModel = schema.isSchemaType(resource.type);

    if (resource.type !== 'cards' && !isCard(resource.type, resource.id)) {
      resource.type = schema.isSchemaType(resource.type) ? resource.type : `${id}${cardIdDelim}${resource.type}`;
      resource.id = `${id}${cardIdDelim}${resource.id}`;
    }
    if (!isSchemaModel && resource.type !== 'cards') {
      for (let field of Object.keys(resource.attributes || {})) {
        if (!resource.attributes) { continue; }
        let fieldName = namespacedResourceId(cards, field);//`${id}${cardIdDelim}${field}`;
        resource.attributes[fieldName] = resource.attributes[field];
        delete resource.attributes[field];
      }
    }
    for (let field of Object.keys(resource.relationships || {})) {
      if (!resource.relationships || (resource.type === 'cards' && field === 'model')) { continue; }
      let fieldName = isSchemaModel || resource.type === 'cards' || field === 'adopted-from' ? field : namespacedResourceId(cards, field); //`${id}${cardIdDelim}${field}`;
      if (!isSchemaModel && resource.type !== 'cards') {
        resource.relationships[fieldName] = resource.relationships[field];
        delete resource.relationships[field];
      }
      let linkage: ResourceLinkage = get(resource, `relationships.${fieldName}.data`);
      // I believe the namespace for the documents that are not cards nor fields (i.e. internal models) for the relationships
      // retain the id of this card, and not the ID of the adopted card--as these internal models, despite using
      // content types that may originate from the adopted card are unique this this card and should be namespaced as such.
      let prefix = resource.type === 'cards' ? resource.id : id;
      if (Array.isArray(linkage)) {
        set(resource, `relationships.${fieldName}.data`, (linkage as ResourceIdentifierObject[]).map(i =>
          ({
            type: schema.isSchemaType(i.type) || i.type === 'cards' ? i.type : `${prefix}${cardIdDelim}${i.type}`,
            id: i.type === 'cards' ?
              i.id :
              (
                schema.isSchemaType(i.type) && resource.type !== 'cards' ? namespacedResourceId(cards, i.id, i.type) : `${prefix}${cardIdDelim}${i.id}`
              )
          })
        ));
      } else if (linkage) {
        let linkageType = schema.isSchemaType(linkage.type) || linkage.type === 'cards' ? linkage.type : `${prefix}${cardIdDelim}${linkage.type}`;
        let linkageId = linkageType === 'cards' ?
          linkage.id :
          (
            schema.isSchemaType(linkageType) && resource.type !== 'cards' ? namespacedResourceId(cards, linkage.id, linkageType) : `${prefix}${cardIdDelim}${linkage.id}`
          );
        set(resource, `relationships.${fieldName}.data`, { type: linkageType, id: linkageId });
      }
    }
  }

  return resultingCard;
}

function namespacedResourceId(externalCards: SingleResourceDoc[], id: string, type?: string) {
  for (let card of externalCards) {
    if (type) {
      let includedRefs: string[] = (card.included || []).map((i: ResourceObject) => `${i.type}/${i.id}`);
      if (includedRefs.includes(`${type}/${id}`)) {
        return `${card.data.id}${cardIdDelim}${id}`;
      }
    } else {
      let includedRefs: string[] = (get(card, 'data.relationships.fields.data') || []).map((i: ResourceIdentifierObject) => `${i.id}`);
      if (includedRefs.includes(id)) {
        return `${card.data.id}${cardIdDelim}${id}`;
      }
    }
  }

  if (type) {
    throw new Error(`Cannot determine the namespace for the resource '${type}/${id}' using cards: '${externalCards.map(i => i.data.id).join(', ')}'`);
  } else {
    throw new Error(`Cannot determine the namespace for the field '${id}' using cards: '${externalCards.map(i => i.data.id).join(', ')}'`);
  }
}

function formatHasField(field: todo, format: string) {
  if (!field.isMetadata) { return false; }
  if (format === 'embedded' && !field.neededWhenEmbedded) { return false; }

  return true;
}

export = {
  isCard,
  loadCard,
  getCardId,
  cardIdDelim,
  adaptCardToFormat,
  cardBrowserAssetFields,
  generateInternalCardFormat,
  adaptCardCollectionToFormat,
}