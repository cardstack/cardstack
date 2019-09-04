import Error from '@cardstack/plugin-utils/error';
import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, ResourceObject, ResourceIdentifierObject, CollectionResourceDoc } from "jsonapi-typescript";
import { get, uniqBy, isEqual, sortBy } from 'lodash';
import logger from '@cardstack/logger';
import { join } from "path";
import { tmpdir } from 'os';
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  removeSync,
} from "fs-extra";

const cardsDir: string = join(tmpdir(), 'card_modules');
const cardFileName = 'card.js';
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

async function loadCard(schema: todo, card: SingleResourceDoc) {
  await generateCardModule(card);
  return getCardSchemas(schema, card);
}

// TODO it's possible for cards originating from the same package to have different templates/components
// as a specific card instance could have its schema altered. need to think through how we would represent
// cards that have different components/templates but originate from the same package, or cards
// from the same package but different repositories that have been altered between the different repos.
// Ideally we can leverage the "card adoption" to make simplifying assumptions around cards that share
// similar components/templates, but will also need to be flexible enough to disambiguate cards that have
// differing components/templates that originate from the same package.
async function generateCardModule(card: SingleResourceDoc) {
  if (!card.data.id) { return; }

  let { repository, packageName } = cardContextFromId(card.data.id);
  if (!repository || !packageName) { return; }

  let bareCard: SingleResourceDoc = removeCardMetadata(card);
  let cardFolder: string = join(cardsDir, repository, packageName);
  let cardFile: string = join(cardFolder, cardFileName);
  ensureDirSync(cardFolder);

  if (pathExistsSync(cardFile)) {
    let cardOnDisk: SingleResourceDoc = (await import(cardFile)).default;
    if (cardOnDisk.included) {
      cardOnDisk.included = sortBy(cardOnDisk.included, i => `${i.type}/${i.id}`);
    }
    if (isEqual(bareCard, cardOnDisk)) { return; }
  }

  log.info(`generating on-disk card artifacts for cards/${card.data.id} in ${cardFolder}`);

  createPkgFile(bareCard, cardFolder);
  createBrowserAssets(bareCard, cardFolder);

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
  writeFileSync(cardFile, `module.exports = ${JSON.stringify(bareCard, null, 2)};`, 'utf8');

  // TODO in the future we should await until webpack finishes compiling
  // the browser assets however we determine to manage that...
}

function removeCardMetadata(card: SingleResourceDoc) {
  let bareCard: SingleResourceDoc = {
    data: {
      type: card.data.type,
      id: card.data.id,
      attributes: Object.assign({}, card.data.attributes),
      relationships: Object.assign({}, card.data.relationships)
    },
    included: (card.included || []).concat([])
  };
  bareCard.included = sortBy(bareCard.included, i => `${i.type}/${i.id}`);

  for (let field of Object.keys(bareCard.data.attributes || {})) {
    if (!cardBrowserAssetFields.includes(field) && bareCard.data.attributes) {
      delete bareCard.data.attributes[field];
    }
  }
  for (let field of Object.keys(bareCard.data.relationships || {})) {
    if (!['fields', 'model'].includes(field) && bareCard.data.relationships) {
      delete bareCard.data.relationships[field];
    }
  }
  return bareCard;
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
    if (resource.type === 'cards' || !schema.isSchemaType(resource.type)) { continue; }
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

  let { repository, packageName, cardId } = cardContextFromId(card.data.id);
  let modelContentType: ResourceObject = {
    type: 'content-types',
    id: cardContextToId({ repository, packageName, cardId }),
    relationships: {
      fields: get(card, 'data.relationships.fields') || []
    }
  };
  return modelContentType;
}

function getCardIncludePaths(schema: todo, card: SingleResourceDoc, format: string) {
  let includePaths: string[] = [
    'fields',
    'fields.related-types',
    'fields.constraints',
    'model',
  ];

  for (let { id: fieldId } of (get(card, 'data.relationships.fields.data') || [])) {
    let field = schema.getRealAndComputedField(fieldId);
    if (!field) { continue; }

    // TODO if field is a card relation (we should have "related-cards" in the future)
    // when we'll need to recursively look up the embedded fields for the related card and
    // make sure that is included in our resulting array of include paths
    if (formatHasField(field, format)) {
      // not checking field-type, as that precludes using computed relationships for meta
      // which should be allowed. this will result in adding attr fields here, but that should be harmless
      includePaths.push(`model.${fieldId}`);
    }
  }
  return includePaths;
}

async function adaptCardCollectionToFormat(schema: todo, collection: CollectionResourceDoc, format: string) {
  let included = collection.included || [];
  let data = [];
  for (let resource of collection.data) {
    if (resource.type !== 'cards') {
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

async function adaptCardToFormat(schema: todo, card: SingleResourceDoc, format: string) {
  if (!card.data.id) { throw new Error(`Cannot load card with missing id.`); }
  let id = card.data.id;
  card.data.attributes = card.data.attributes || {};

  let { repository, packageName, cardId } = cardContextFromId(card.data.id);
  let cardModelType = cardContextToId({ repository, packageName, cardId });
  let model = (card.included || []).find(i => `${i.type}/${i.id}` === `${cardModelType}/${id}`);
  if (!model) { throw new Error(`Card model is missing for card 'cards/${id}'`); }
  if (!model.type || !model.id) { throw new Error(`Card model is missing type and/or id '${model.type}/${model.id}' for card 'cards/${id}`); }

  let result: SingleResourceDoc = {
    data: {
      id,
      type: 'cards',
      attributes: {},
      relationships: {
        fields: get(card, 'data.relationships.fields'),
        model: {
          data: { type: model.type, id: model.id }
        }
      }
    }
  };
  if (card.data.meta) {
    result.data.meta = card.data.meta;
  }

  for (let attr of Object.keys(card.data.attributes)) {
    if (!cardBrowserAssetFields.includes(attr) || !result.data.attributes) { continue; }
    result.data.attributes[attr] = card.data.attributes[attr];
  }
  result.included = [model].concat((card.included || []).filter(i => schema.isSchemaType(i.type)));

  for (let { id: fieldId } of (get(card, 'data.relationships.fields.data') || [])) {
    let { modelId: fieldName } = cardContextFromId(fieldId);
    if (!fieldName) { continue; }
    let field = schema.getRealAndComputedField(fieldId);

    if (formatHasField(field, format)) {
      let fieldAttrValue = get(model, `attributes.${fieldId}`);
      let fieldRelValue = get(model, `relationships.${fieldId}`);

      if (!field.isRelationship && fieldAttrValue !== undefined && result.data.attributes) {
        result.data.attributes[fieldName] = fieldAttrValue;
      } else if (field.isRelationship && fieldRelValue !== undefined && result.data.relationships && result.included) {
        result.data.relationships[fieldName] = Object.assign({}, fieldRelValue);
        let includedResources: ResourceObject[] = [];
        if (Array.isArray(fieldRelValue.data)) {
          let relRefs = fieldRelValue.data.map((i: ResourceIdentifierObject) => `${i.type}/${i.id}`);
          includedResources = card.included ? card.included.filter(i => relRefs.includes(`${i.type}/${i.id}`)) : [];
        } else {
          let includedResource = card.included && card.included.find(i => `${i.type}/${i.id}` === `${fieldId}/${fieldRelValue.data.id}`);
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
  cardIdDelim,
  cardContextFromId,
  cardContextToId,
  loadCard,
  getCardIncludePaths,
  adaptCardToFormat,
  adaptCardCollectionToFormat,
}