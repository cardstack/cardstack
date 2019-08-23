import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, ResourceObject, ResourceIdentifierObject, CollectionResourceDoc } from "jsonapi-typescript";
import { get, uniqBy } from 'lodash';

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
  'edit-template',
  'edit-js',
  'edit-css',
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

function schemaModelsForCard(schema: todo, card: SingleResourceDoc) {
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

  let { repository, packageName } = cardContextFromId(card.data.id);
  let modelContentType: ResourceObject = {
    type: 'content-types',
    id: cardContextToId({ repository, packageName }),
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
  if (!card.data.attributes) { throw new Error(`Card is missing attributes '${card.data.type}/${card.data.id}`); }

  let { repository, packageName } = cardContextFromId(card.data.id);
  let cardModelType = cardContextToId({ repository, packageName });
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
    let { cardId: fieldName } = cardContextFromId(fieldId);
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
  schemaModelsForCard,
  getCardIncludePaths,
  adaptCardToFormat,
  adaptCardCollectionToFormat,
}