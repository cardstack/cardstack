import Session from '@cardstack/plugin-utils/session';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, ResourceObject, ResourceIdentifierObject, CollectionResourceDoc } from 'jsonapi-typescript';
import { get, uniqBy } from 'lodash';

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
interface CardContext {
  repository: string;
  packageName: string;
  cardId?: string;
  modelId?: string;
}

export = declareInjections({
  writers: 'hub:writers',
  indexers: 'hub:indexers',
  searchers: 'hub:searchers',
  currentSchema: 'hub:current-schema',
},

class CardServices {
  writers: todo;
  indexers: todo;
  searchers: todo;
  currentSchema: todo;

  async get(session: Session, id: string, format: string) {
    let includePaths = await this.getCardIncludePaths(id, format);
    let rawCard = await this.searchers.get(session, 'local-hub', 'cards', id, { includePaths });

    let card = await this.adaptCardToFormat(rawCard, format);
    // TODO need to run this through read authorization for the session used to request card

    return card;
  }

  async search(session: Session, format: string, query: todo) {
    let results: CollectionResourceDoc = { data: [], included:[] };
    if (!results.included) { return; } // because TS

    let cards: CollectionResourceDoc = await this.searchers.search(session, query);
    for (let card of cards.data) {
      if (card.id == null) { continue; }
      // We need to make sure to retain the includeds for the cards (as this contains schema details)
      // so we should run the search results through this.get() to ensure the card is populated correctly.
      let { data, included } = await this.get(session, card.id, format);
      results.data.push(data);
      results.included.concat(included || []);
    }
    results.included = uniqBy(results.included, i => `${i.type}/${i.id}`);
    // TODO need to run this through read authorization for the session used to request card

    return results;
  }

  private async getCardIncludePaths(id: string, format: string) {
    let card: SingleResourceDoc = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', 'cards', id);
    // make sure to get the schema *after* getting the card, as getting the card may trigger
    // newly discovered card schema to be loaded
    let schema = await this.currentSchema.getSchema();
    let includePaths: string[] = [
      'fields',
      'fields.related-types',
      'fields.constraints',
      'model',
    ];

    for (let { id: fieldId } of (get(card, 'data.relationships.fields.data') || [])) {
      let field = schema.realAndComputedFields.get(fieldId);
      if (!field) { continue; }

      // TODO if field is a card relation (we should have "related-cards" in the future)
      // when we'll need to recursively look up the embedded fields for the related card and
      // make sure that is included in our resulting array of include paths
      if (this.formatHasField(field, format)) {
        // not checking field-type, as that precludes using computed relationships for meta
        // which should be allowed. this will result in adding attr fields here, but that should be harmless
        includePaths.push(`model.${fieldId}`);
      }
    }
    return includePaths;
  }

  private async adaptCardToFormat(card: SingleResourceDoc, format: string) {
    if (!card.data.id) { throw new Error(`Cannot load card with missing id.`); }
    let id = card.data.id;
    if (!card.data.attributes) { throw new Error(`Card is missing attributes '${card.data.type}/${card.data.id}`); }

    let { repository, packageName } = cardContextFromId(card.data.id);
    let cardModelType = cardContextToId({ repository, packageName });
    let model = (card.included || []).find(i => `${i.type}/${i.id}` === `${cardModelType}/${id}`);
    if (!model) { throw new Error(`Card model is missing for card 'cards/${id}'`); }
    if (!model.type || !model.id) { throw new Error(`Card model is missing type and/or id '${model.type}/${model.id}' for card 'cards/${id}`); }

    let schema = await this.currentSchema.getSchema();
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

    for (let attr of Object.keys(card.data.attributes)) {
      if (!cardBrowserAssetFields.includes(attr) || !result.data.attributes) { continue; }
      result.data.attributes[attr] = card.data.attributes[attr];
    }
    result.included = [model].concat((card.included || []).filter(i => schema.isSchemaType(i.type)));

    for (let { id: fieldId } of (get(card, 'data.relationships.fields.data') || [])) {
      let field = schema.realAndComputedFields.get(fieldId);

      if (this.formatHasField(field, format)) {
        let { cardId: fieldName } = cardContextFromId(fieldId);
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

  private formatHasField(field: todo, format: string) {
    if (!field.isMetadata) { return false; }
    if (format === 'embedded' && !field.neededWhenEmbedded) { return false; }

    return true;
  }
});

function cardContextFromId(id: string) {
  let [repository, packageName, cardId, modelId] = id.split(cardIdDelim);

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
