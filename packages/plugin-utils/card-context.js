/*
 * Model ID's will be in the format:
 *   source::package-name::card-id::model-id:::snapshot-version
*/

const Error = require('./error');
const { get } = require('lodash');

const cardContextDelim = '::';
const cardVersionDelim = ':::';
const currentVersionLabel = '_current_';

function cardDefinitionIdFromId(id) {
  let { sourceId, packageName } = cardContextFromId(id);
  return cardContextToId({ sourceId, packageName });
}

function cardIdFromId(id) {
  let { sourceId, packageName, upstreamId } = cardContextFromId(id);
  return cardContextToId({ sourceId, packageName, upstreamId });
}

function isCard(id) {
  let { upstreamId } = cardContextFromId(id);
  return upstreamId != null;
}

function hasCardDefinition(id) {
  let { packageName } = cardContextFromId(id);
  return packageName != null;
}

function cardContextFromId(id) {
  let [ idPart='', snapshotVersion ] = id.split(cardVersionDelim);
  let [ sourceId, packageName, upstreamId, modelId ] = idPart.split(cardContextDelim);

  return {
    sourceId,
    packageName,
    upstreamId,
    modelId,
    snapshotVersion
  };
}

function cardContextToId({
  sourceId,
  packageName,
  upstreamId,
  modelId,
  snapshotVersion
}) {
  let idPart = [ sourceId, packageName, upstreamId, modelId ].filter(i => i != null).join(cardContextDelim);
  return [ idPart, snapshotVersion ].filter(i => i != null).join(cardVersionDelim);
}

function addContextForCardDefinition(sourceId, packageName, schemaDocument) {
  let { data: cardDefinition, included = [] } = schemaDocument;
  let idMap = {};

  if (cardDefinition.type !== 'card-definitions') {
    throw new Error(`The schema feature for the package '${packageName}' defines a schema document that is not of type 'card-definitions', found ${cardDefinition.type}.`);
  }
  idMap[`card-definitions/${cardDefinition.id}`] = cardContextToId({ sourceId, packageName });
  let idSet = {};
  for (let resource of included) {
    // schema models are treated as cards
    let upstreamId = [
      'content-types',
      'fields',
      'computed-fields'
    ].includes(resource.type) ? get(resource, 'attributes.name') : resource.id;
    let contextualId = cardContextToId({ sourceId, packageName, upstreamId });
    if (idSet[`${resource.type}/${contextualId}`]) {
      throw new Error(`The schema feature for the package '${packageName}' defines duplicatively named schema elements: ${resource.type}/${contextualId}`);
    }
    idSet[`${resource.type}/${contextualId}`] = true;
    idMap[`${resource.type}/${resource.id}`] = contextualId;
  }

  replaceIdsForResource(cardDefinition, idMap);
  for (let resource of included) {
    replaceIdsForResource(resource, idMap);
  }

  let cardModelType = get(cardDefinition, 'relationships.model.data.type');
  let cardModelId = get(cardDefinition, 'relationships.model.data.id');
  if (cardModelId == null || !cardModelType) { return; }

  let cardModelSchema = included.find(i => `${i.type}/${i.id}` === `${cardModelType}/${cardModelId}`);
  if (!cardModelSchema) { return; }

  cardModelSchema.attributes = cardModelSchema.attributes || {};

  included.filter(i => i.type === 'content-types').forEach(modelSchema => {
    modelSchema.relationships = modelSchema.relationships || {};
    modelSchema.relationships.fields = modelSchema.relationships.fields || {};
    modelSchema.relationships.fields.data = modelSchema.relationships.fields.data || [];
    modelSchema.relationships.fields.data.push({ type: 'computed-fields', id: 'card-context' });
    modelSchema.attributes = modelSchema.attributes || {};
    modelSchema.attributes['default-includes'] = modelSchema.attributes['default-includes'] || [];
    modelSchema.attributes['default-includes'].push('card-context');
  });

  // TODO what about card's router? do we need to do special things there in terms of adding the context to the card queries in the router?

  return schemaDocument;
}

function modelsOf(document = {}) {
  let { data, included = [] } = document;
  if (!data) { return []; }

  let models = [data];
  return models.concat(included);
}

function replaceIdsForResource(resource, idMap) {
  resource.id = idMap[`${resource.type}/${resource.id}`] || resource.id;
  if (!resource.relationships) { return; }

  for (let relationship of Object.keys(resource.relationships)) {
    if (resource.relationships[relationship].data && Array.isArray(resource.relationships[relationship].data)) {
      resource.relationships[relationship].data.forEach(ref => {
        ref.id = idMap[`${ref.type}/${ref.id}`] || ref.id;
      });
    } else if (resource.relationships[relationship].data) {
      let ref = resource.relationships[relationship].data;
      ref.id = idMap[`${ref.type}/${ref.id}`] || ref.id;
    }
  }
}

module.exports = {
  addContextForCardDefinition,
  currentVersionLabel,
  cardContextFromId,
  cardContextToId,
  cardContextDelim,
  cardIdFromId,
  cardDefinitionIdFromId,
  isCard,
  hasCardDefinition,
  modelsOf
};