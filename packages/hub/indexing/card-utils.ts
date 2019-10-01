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
import { set, get, uniqBy, isEqual, sortBy, cloneDeep } from 'lodash';
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

async function loadCard(schema: todo, card: SingleResourceDoc) {
  if (!card || !card.data || !card.data.id) { return; }

  // a searcher or indexer may be returning invalid cards, so we
  // need to make sure to validate the internal card format.
  validateInternalCardFormat(schema, card);

  await generateCardModule(card);
  return getCardSchemas(schema, card);
}

function getCardId(id: string | number | undefined) {
  if (id == null) { return; }
  if (String(id).split(cardIdDelim).length < 3) { return; }
  let { repository, packageName, cardId } = cardContextFromId(id);
  return cardContextToId({ repository, packageName, cardId });
}

function validateInternalCardFormat(schema: todo, card: SingleResourceDoc) {
  let id = card.data.id as string;
  let type = card.data.type as string;
  if (!id) { throw new Error(`The card ID must be supplied in the card document`, { status: 400, source: { pointer: '/data/id' }}); }
  if (!type) { throw new Error(`The card type must be supplied in the card document`, { status: 400, source: { pointer: '/data/type' }}); }

  if (id !== type) { throw new Error(`The card '${id}' has a card model content-type that does not match its id: '${type}'`, { status: 400, source: { pointer: '/data/id'}}); }

  let fields: ResourceIdentifierObject[] = get(card, 'data.relationships.fields.data') || [];
  let foreignFieldIndex = fields.findIndex(i => !(i.id.includes(id)));
  if (foreignFieldIndex > -1 ) { throw new Error(`The card '${id}' uses a foreign field '${fields[foreignFieldIndex].type}/${fields[foreignFieldIndex].id}`, { status: 400, source: { pointer: `/data/relationships/fields/data/${foreignFieldIndex}`}}); }

  let modelRelationships: string[] = Object.keys(get(card, 'data.relationships') || {}).filter(i => i !== 'fields');
  for (let rel of modelRelationships) {
    let linkage: ResourceLinkage = get(card, `data.relationships.${rel}.data`);
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
  if (!card.included) { return; }
  let foreignIncludedIndex = (card.included || []).findIndex(i => !isCard(i.type, i.id) && i.id != null && ((!schema.isSchemaType(i.type) && !i.type.includes(id)) || !i.id.includes(id)));
  if (foreignIncludedIndex > -1 ) { throw new Error(`The card '${id}' contains included foreign internal models '${card.included[foreignIncludedIndex].type}/${card.included[foreignIncludedIndex].id}`, { status: 400, source: { pointer: `/included/${foreignIncludedIndex}`}}); }
}

function validateExternalCardFormat(card: SingleResourceDoc) {
  let id = card.data.id as string;
  if (!id) {
    throw new Error(`The card ID must be supplied in the card document`, { status: 400, source: { pointer: '/data/id' } });
  }
  if (card.data.type !== 'cards') {
    throw new Error(`The document type for card '${id}' is not 'cards', rather it is '${card.data.type}'`, { status: 400, source: { pointer: '/data/type' } });
  }

  let modelLinkage: ResourceIdentifierObject = get(card, 'data.relationships.model.data');
  if (!modelLinkage) {
    throw new Error(`The card 'cards/${id}' is missing its card model '${id}/${id}'.`, { status: 400, source: { pointer: '/data/relationships/model/data' } });
  }

  if (modelLinkage.type !== id || modelLinkage.id !== id) {
    throw new Error(`For the card '${id}', the card model does not match the card id. The card model is '${modelLinkage.type}/${modelLinkage.id}'`, { status: 400, source: { pointer: '/data/relationships/model/data' } });
  }
  if (!(card.included || []).find(i => `${i.type}/${i.id}` === `${id}/${id}`)) {
    throw new Error(`The specified card model '${id}/${id}' is missing for card '${id}'`, { status: 400, source: { pointer: '/data/relationships/model/data' } });
  }
}

function generateInternalCardFormat(schema: todo, card: SingleResourceDoc) {
  let id = card.data.id as string;
  if (!id) { throw new Error(`The card ID must be supplied in the card document in order to create the card.`); }

  validateExternalCardFormat(card);

  card = addCardNamespacing(schema, card) as SingleResourceDoc;
  let model: ResourceObject | undefined = (card.included || []).find(i => `${i.type}/${i.id}` === `${id}/${id}`);
  if (!model) { throw new Error(`The card 'cards/${id}' is missing its card model '${id}/${id}'.`, { status: 400, source: { pointer: '/data/relationships/model/data' }}); }

  let fields: ResourceIdentifierObject[] = get(card, 'data.relationships.fields.data') || [];
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

  let nonModelCardResources = cloneDeep((card.included || [])
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
    data: cloneDeep(card.data),
    included: sortBy(card.included, i => `${i.type}/${i.id}`)
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
    attributes: { 'default-includes': defaultIncludes },
    relationships: { fields }
  };
  return modelContentType;
}

async function adaptCardCollectionToFormat(schema: todo, session: Session, collection: CollectionResourceDoc, format: string, cardServices: todo) {
  let included: ResourceObject[] = [];
  let data: ResourceObject[] = [];
  for (let resource of collection.data) {
    if (!isCard(resource.type, resource.id)) {
      data.push(resource);
      continue;
    }
    let { data:cardResource, included:cardIncluded = [] } = await adaptCardToFormat(schema, session, { data: resource, included: collection.included }, format, cardServices);
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

async function adaptCardToFormat(schema: todo, session: Session, cardModel: SingleResourceDoc, format: string, cardServices: todo) {
  if (!cardModel.data || !cardModel.data.id) { throw new Error(`Cannot load card with missing id.`); }

  let id = cardModel.data.id;
  cardModel.data.attributes = cardModel.data.attributes || {};

  // we need to make sure that grants don't interfere with our ability to get the card schema
  let priviledgedCard: SingleResourceDoc | undefined;
  if (session !== Session.INTERNAL_PRIVILEGED) {
    try {
      priviledgedCard = await cardServices.get(Session.INTERNAL_PRIVILEGED, id, 'isolated');
    } catch (e) {
      if (e.status !== 404) { throw e; }
    }
  }
  if (priviledgedCard) {
    priviledgedCard = generateInternalCardFormat(schema, priviledgedCard);
  }
  priviledgedCard = priviledgedCard || cardModel;

  let cardSchema = getCardSchemas(schema, priviledgedCard) || [];
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
    },
    included: []
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
    let linkage: ResourceLinkage = get(cardModel, `data.relationships.${rel}.data`);
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
    result.included = [model].concat((cardModel.included || []).filter(i => schema.isSchemaType(i.type)));
  }

  for (let { id: fieldId } of (get(priviledgedCard, 'data.relationships.fields.data') || [])) {
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
          let relRefs = (fieldRelValue as ResourceIdentifierObject[]).map((i: ResourceIdentifierObject) => `${i.type}/${i.id}`);
          includedResources = cardModel.included ? cardModel.included.filter(i => relRefs.includes(`${i.type}/${i.id}`)) : [];
        } else {
          let includedResource = cardModel.included && cardModel.included.find(i =>
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
            let { data: cardResource } = await cardServices.get(session, resource.id, 'embedded');
            resolvedIncluded.push(cardResource);
          }
        }

        result.included = result.included.concat(resolvedIncluded);
      }
    }
  }
  result.included = uniqBy(result.included, i => `${i.type}/${i.id}`);
  return removeCardNamespacing(result) as SingleResourceDoc;
}

// TODO in the future as part of supporting card adoption, we'll likely need to
// preserve the namespacing of adopted card fields in the external card document
function removeCardNamespacing(card: SingleResourceDoc) {
  let id = card.data.id as string;
  if (!id) { return; }

  let resultingCard = cloneDeep(card) as SingleResourceDoc;
  for (let resource of [resultingCard.data].concat(resultingCard.included || [])) {
    if (resource.type !== 'cards' && !isCard(resource.type, resource.id)) {
      resource.type = getCardId(resource.type) ? cardContextFromId(resource.type).modelId as string : resource.type;
      resource.id = getCardId(resource.id) && resource.id != null ? cardContextFromId(resource.id).modelId as string : resource.id;
    }
    for (let field of Object.keys(resource.attributes || {})) {
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
        set(resource, `relationships.${fieldName}.data`, (linkage as ResourceIdentifierObject[]).map(i => ({
          type: i.type !== 'cards' && getCardId(i.type) ? cardContextFromId(i.type).modelId : i.type,
          id: i.type !== 'cards' && getCardId(i.id) ? cardContextFromId(i.id).modelId : i.id,
        })));
      } else if (linkage) {
        let linkageType = linkage.type !== 'cards' && getCardId(linkage.type) ? cardContextFromId(linkage.type).modelId : linkage.type;
        let linkageId = linkage.type !== 'cards' && getCardId(linkage.id) ? cardContextFromId(linkage.id).modelId : linkage.id;
        set(resource, `relationships.${fieldName}.data`, { type: linkageType, id: linkageId });
      }
    }
  }

  return resultingCard;
}

function addCardNamespacing(schema: todo, card: SingleResourceDoc) {
  let id = getCardId(card.data.id);
  if (!id) { return; }

  let resultingCard = cloneDeep(card) as SingleResourceDoc;
  for (let resource of [resultingCard.data].concat(resultingCard.included || [])) {
    let isSchemaModel = schema.isSchemaType(resource.type);
    if (resource.type !== 'cards' && !isCard(resource.type, resource.id)) {
      resource.type = schema.isSchemaType(resource.type) ? resource.type : `${id}${cardIdDelim}${resource.type}`;
      resource.id = `${id}${cardIdDelim}${resource.id}`;
    }
    if (!isSchemaModel && resource.type !== 'cards') {
      for (let field of Object.keys(resource.attributes || {})) {
        if (!resource.attributes) { continue; }
        let fieldName = `${id}${cardIdDelim}${field}`;
        resource.attributes[fieldName] = resource.attributes[field];
        delete resource.attributes[field];
      }
    }
    for (let field of Object.keys(resource.relationships || {})) {
      if (!resource.relationships || (resource.type === 'cards' && field === 'model')) { continue; }
      let fieldName = isSchemaModel || resource.type === 'cards' ? field : `${id}${cardIdDelim}${field}`;
      if (!isSchemaModel && resource.type !== 'cards') {
        resource.relationships[fieldName] = resource.relationships[field];
        delete resource.relationships[field];
      }
      let linkage: ResourceLinkage = get(resource, `relationships.${fieldName}.data`);
      if (Array.isArray(linkage)) {
        set(resource, `relationships.${fieldName}.data`, (linkage as ResourceIdentifierObject[]).map(i => ({
          type: schema.isSchemaType(i.type) || i.type === 'cards' ? i.type : `${id}${cardIdDelim}${i.type}`,
          id: i.type !== 'cards' ? `${id}${cardIdDelim}${i.id}` : i.id,
        })));
      } else if (linkage) {
        let linkageType = schema.isSchemaType(linkage.type) || linkage.type === 'cards' ? linkage.type : `${id}${cardIdDelim}${linkage.type}`;
        let linkageId = linkage.type !== 'cards' ? `${id}${cardIdDelim}${linkage.id}` : linkage.id;
        set(resource, `relationships.${fieldName}.data`, { type: linkageType, id: linkageId });
      }
    }
  }

  return resultingCard;
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