import Error from '@cardstack/plugin-utils/error';
import { todo } from '@cardstack/plugin-utils/todo-any';
import {
  SingleResourceDoc,
  ResourceObject,
  ResourceIdentifierObject,
  CollectionResourceDoc,
  AttributesObject,
  RelationshipsObject,
  RelationshipsWithData
} from "jsonapi-typescript";
import { set, get, uniqBy, isEqual, sortBy } from 'lodash';
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

const cardIdDelim = '::';
const cardBrowserAssetFields = [
  'isolated-template',
  'isolated-js',
  'isolated-css',
  'embedded-template',
  'embedded-js',
  'embedded-css',
];

function cardContextFromId(id: string) {
  let noContext: CardContext = {};
  if (id == null) { return noContext; }

  let idSplit = id.split(cardIdDelim);
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

async function loadCard(schema: todo, card: SingleResourceDoc) {
  if (!card || !card.data || !card.data.id) { return; }

  await generateCardModule(card);
  return getCardSchemas(schema, card);
}

function getCardId(id: string) {
  let { repository, packageName, cardId } = cardContextFromId(id);
  return cardContextToId({ repository, packageName, cardId });
}

function generateInternalCardFormat(card: SingleResourceDoc) {
  let id = card.data.id as string;
  if (!id) { throw new Error(`The card ID must be supplied in the card document in order to create the card.`); }

  let model: ResourceObject | undefined = (card.included || []).find(i => `${i.type}/${i.id}` === `${id}/${id}`);
  if (!model) { throw new Error(`The card document 'cards/${id}' is missing its card model '${id}/${id}'.`); }

  let fields: ResourceIdentifierObject[]  = get(card, 'data.relationships.fields.data') || [];
  set(model, 'relationships.fields.data', fields);
  let version = get(card, 'data.meta.version');
  if (version != null) {
    set(model, 'meta.version', version);
  }
  for (let field of cardBrowserAssetFields) {
    let value = get(card, `data.attributes.${field}`) as string;
    if (!value) { continue; }
    set(model, `attributes.${field}`, value);
  }

  let nonModelCardResources = (card.included || [])
    .filter(i => model &&
      `${i.type}/${i.id}` !== `${model.type}/${model.id}` &&
      (i.id || '').includes(id));

  return { data: model, included: nonModelCardResources };
}

// TODO it's possible for cards originating from the same package to have different templates/components
// as a specific card instance could have its schema altered. need to think through how we would represent
// cards that have different components/templates but originate from the same package, or cards
// from the same package but different repositories that have been altered between the different repos.
// Ideally we can leverage the "card adoption" to make simplifying assumptions around cards that share
// similar components/templates, but will also need to be flexible enough to disambiguate cards that have
// differing components/templates that originate from the same package.
async function generateCardModule(card: SingleResourceDoc) {
  if (!card || !card.data || !card.data.id) { return; }

  let { repository, packageName } = cardContextFromId(card.data.id);
  if (!repository || !packageName) { return; }

  let cleanCard: SingleResourceDoc = {
    data: { ...card.data },
    included: sortBy(card.included, i => `${i.type}/${i.id}`)
  };
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

  log.info(`generating on-disk card artifacts for cards/${card.data.id} in ${cardFolder}`);

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

function createBrowserAssets(card: SingleResourceDoc, cardFolder: string) {
  if (!card.data.attributes) { return; }

  for (let field of cardBrowserAssetFields) {
    let content: string = card.data.attributes[field] as string;
    content = (content || '').trim();
    let [ assetType, extension ] = field.split('-');
    extension = extension === 'template' ? 'hbs' : extension;
    let file = join(cardFolder, `${assetType}.${extension}`);
    if (!content) {
      log.debug(`ensuring browser asset doesn't exist for cards/${card.data.id} at ${file}`);
      removeSync(file);
    } else {
      log.debug(`generating browser asset for cards/${card.data.id} at ${file}`);
      writeFileSync(file, content, 'utf8');
    }
  }
}

function createPkgFile(card: SingleResourceDoc, cardFolder: string) {
  if (!card.data.id) { return; }

  let { packageName:name } = cardContextFromId(card.data.id);
  let version = '0.0.0'; // TODO deal with version numbers

  log.debug(`generating package.json for cards/${card.data.id} at ${join(cardFolder, 'package.json')}`);
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

function getCardSchemas(schema: todo, card: SingleResourceDoc) {
  if (!card) { return; }
  if (!card.data.id) { return; }

  let schemaModels: ResourceObject[] = [];

  for (let resource of (card.included || [])) {
    if (!schema.isSchemaType(resource.type)) { continue; }
    schemaModels.push(resource);
  }
  let cardModelSchema = deriveCardModelContentType(card);
  if (cardModelSchema) {
    schemaModels.push(cardModelSchema);
  }
  return schemaModels;
}

function deriveCardModelContentType(card: SingleResourceDoc) {
  if (!card.data.id) { return; }
  let id = getCardId(card.data.id);

  let fields: RelationshipsWithData = {
    data: [{ type: 'fields', id: 'fields' }].concat(
      cardBrowserAssetFields.map(i => ({ type: 'fields', id: i})),
      get(card, 'data.relationships.fields.data') || []
    )
  };

  // not checking field-type, as that precludes using computed relationships for meta
  // which should be allowed. this will result in adding attr fields here, but that should be harmless
  let defaultIncludes = [
    'fields',
    'fields.related-types',
    'fields.constraints',
  ].concat((get(card, 'data.relationships.fields.data') || [])
    .map((i: ResourceIdentifierObject) => i.id));

  let modelContentType: ResourceObject = {
    id,
    type: 'content-types',
    id: cardContextToId({ repository, packageName, cardId }),
    attributes: { 'default-includes': defaultIncludes },
    relationships: { fields }
  };
  return modelContentType;
}

async function adaptCardCollectionToFormat(schema: todo, collection: CollectionResourceDoc, format: string) {
  let included: ResourceObject[] = [];
  let data: ResourceObject[] = [];
  for (let resource of collection.data) {
    if (!isCard(resource.type, resource.id)) {
      data.push(resource);
      continue;
    }
    let { data:cardResource, included:cardIncluded } = await adaptCardToFormat(schema, { data: resource, included: collection.included }, format);
    included = included.concat(cardIncluded || []);
    data.push(cardResource);
  }
  let rootItems = data.map(i => `${i.type}/${i.id}`);
  included = uniqBy(included.filter(i => !rootItems.includes(`${i.type}/${i.id}`)), j => `${j.type}/${j.id}`);
  let document: CollectionResourceDoc = { data };
  if (included.length) {
    document.included = included;
  }
  return document;
}

async function adaptCardToFormat(schema: todo, cardModel: SingleResourceDoc, format: string) {
  if (!cardModel.data.id) { throw new Error(`Cannot load card with missing id.`); }

  let id = cardModel.data.id;
  cardModel.data.attributes = cardModel.data.attributes || {};

  let cardSchema = getCardSchemas(schema, cardModel) || [];
  schema = await schema.applyChanges(cardSchema.map(document => ({ id:document.id, type:document.type, document })));

  let result: SingleResourceDoc = {
    data: {
      id,
      type: 'cards',
      attributes: {},
      relationships: {
        fields: get(cardModel, 'data.relationships.fields'),
        model: {
          data: { type: cardModel.data.type, id: cardModel.data.id }
        }
      }
    }
  };
  if (cardModel.data.meta) {
    result.data.meta = cardModel.data.meta;
  }

  let attributes: AttributesObject = {};
  for (let attr of Object.keys(cardModel.data.attributes)) {
    if (cardBrowserAssetFields.includes(attr) && result.data.attributes) {
      result.data.attributes[attr] = cardModel.data.attributes[attr];
    } else {
      attributes[attr] = cardModel.data.attributes[attr];
    }
  }
  let relationships: RelationshipsObject = {};
  for (let rel of Object.keys(cardModel.data.relationships || {})) {
    if (rel === 'fields' || !cardModel.data.relationships) { continue; }
    relationships[rel] = cardModel.data.relationships[rel];
  }
  let model: ResourceObject = {
    id,
    type: id,
    attributes,
    relationships
  };
  result.included = [model].concat((cardModel.included || []).filter(i => schema.isSchemaType(i.type)));

  for (let { id: fieldId } of (get(cardModel, 'data.relationships.fields.data') || [])) {
    let { modelId: fieldName } = cardContextFromId(fieldId);
    if (!fieldName) { continue; }
    let field = schema.getRealAndComputedField(fieldId);

    if (formatHasField(field, format)) {
      let fieldAttrValue = get(cardModel, `data.attributes.${fieldId}`);
      let fieldRelValue = get(cardModel, `data.relationships.${fieldId}`);

      if (!field.isRelationship && fieldAttrValue !== undefined && result.data.attributes) {
        result.data.attributes[fieldName] = fieldAttrValue;
      } else if (field.isRelationship && fieldRelValue !== undefined && result.data.relationships && result.included) {
        result.data.relationships[fieldName] = Object.assign({}, fieldRelValue);
        let includedResources: ResourceObject[] = [];
        if (Array.isArray(fieldRelValue.data)) {
          let relRefs = fieldRelValue.data.map((i: ResourceIdentifierObject) => `${i.type}/${i.id}`);
          includedResources = cardModel.included ? cardModel.included.filter(i => relRefs.includes(`${i.type}/${i.id}`)) : [];
        } else {
          let includedResource = cardModel.included && cardModel.included.find(i => `${i.type}/${i.id}` === `${fieldId}/${fieldRelValue.data.id}`);
          if (includedResource) {
            includedResources = [includedResource];
          }
        }
        result.included = result.included.concat(includedResources);
      }
    }
  }

  return result;
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
  adaptCardToFormat,
  cardBrowserAssetFields,
  generateInternalCardFormat,
  adaptCardCollectionToFormat,
}