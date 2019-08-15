import Session from '@cardstack/plugin-utils/session';
import { cardContextFromId, cardContextToId, cardIdDelimiter } from '@cardstack/plugin-utils/card-context';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, ResourceObject, ResourceIdentifierObject, CollectionResourceDoc } from 'jsonapi-typescript';
import { get, uniqBy } from 'lodash';

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

  // TODO should we care about the session of the caller who is requesting to load the card?
  async loadCard(card: SingleResourceDoc) {
    if (!card.data.id) { throw new Error(`Cannot load card with missing id.`); }
    let cardId = card.data.id;

    let existingCardModel;
    let { repository, packageName } = cardContextFromId(cardId);
    let cardModelType = cardContextToId({ repository, packageName });
    try {
      // use the card's model to check for presence of a card, as checking for the presence using
      // the card itself will result in cycle as the act of searching for a card here will
      // trigger a card to be loaded if it does not exist in the index.
      existingCardModel = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', cardModelType, cardId);
    } catch (e) { if (e.status !== 404) { throw e; } }

    if (existingCardModel) {
      // we've already loaded this card so just stop. maybe in
      // the future we can pay attention to the card version and
      // reload if version has changed...
      return;
    }

    let schemaModels = await this.buildCardModelSchema(card);
    if (!schemaModels) { return; }

    for (let model of schemaModels) {
      await this.writers.create(Session.INTERNAL_PRIVILEGED, model.type, { data: model });
    }
    await this.writers.create(Session.INTERNAL_PRIVILEGED, 'cards', card);

    let internalCardModels = await this.getInternalCardModels(card);
    for (let model of internalCardModels) {
      await this.writers.create(Session.INTERNAL_PRIVILEGED, model.type, { data: model });
    }

    // TODO how should we handle included resources that are other cards? recusively call into this function?
  }

  async get(session: Session, id: string, format: string) {
    let rawCard = await this.searchers.get(session, 'local-hub', 'cards', id);
    let { repository, packageName } = cardContextFromId(id);
    let cardModelType = cardContextToId({ repository, packageName });
    let model = await this.searchers.get(session, 'local-hub', cardModelType, id);

    let card = await this.adaptCardToFormat(rawCard, model, format);
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

  private async getInternalCardModels(card: SingleResourceDoc) {
    let cardModels: ResourceObject[] = [];
    let schema = await this.currentSchema.getSchema();

    for (let resource of (card.included || [])) {
      if (resource.type === 'cards' || schema.isSchemaType(resource.type)) { continue; }
      cardModels.push(resource);
    }

    return cardModels;
  }

  private async adaptCardToFormat(card: SingleResourceDoc, model: SingleResourceDoc, format: string) {
    if (!model.data.type || !model.data.id) { throw new Error(`Card model is missing type and/or id '${model.data.type}/${model.data.id}'`); }
    if (!card.data.attributes) { throw new Error(`Card is missing attributes '${card.data.type}/${card.data.id}`); }

    let schema = await this.currentSchema.getSchema();
    let result: SingleResourceDoc = {
      data: {
        type: 'cards',
        id: card.data.id,
        attributes: {},
        relationships: {
          fields: get(card, 'data.relationships.fields'),
          model: {
            data: { type: model.data.type, id: model.data.id }
          }
        }
      }
    };

    for (let attr of Object.keys(card.data.attributes)) {
      if (!cardBrowserAssetFields.includes(attr) || !result.data.attributes) { continue; }
      result.data.attributes[attr] = card.data.attributes[attr];
    }
    result.included = [model.data].concat((card.included || []).filter(i => schema.isSchemaType(i.type)));

    for (let { id: fieldId } of (get(card, 'data.relationships.fields.data') || [])) {
      let field = schema.realAndComputedFields.get(fieldId);

      if (this.formatHasField(field, format)) {
        let fieldAttrValue = get(model, `data.attributes.${field.name}`);
        let fieldRelValue = get(model, `data.relationships.${field.name}`);

        if (!field.isRelationship && fieldAttrValue !== undefined && result.data.attributes) {
          result.data.attributes[field.name] = fieldAttrValue;
        } else if (field.isRelationship && fieldRelValue !== undefined && result.data.relationships && result.included) {
          result.data.relationships[field.name] = Object.assign({}, fieldRelValue);
          let includedResources: ResourceObject[] = [];
          if (Array.isArray(fieldRelValue.data)) {
            let relRefs = fieldRelValue.data.map((i: ResourceIdentifierObject) => `${i.type}/${i.id}`);
            includedResources = model.included ? model.included.filter(i => relRefs.includes(`${i.type}/${i.id}`)) : [];
          } else {
            let includedResource = model.included && model.included.find(i => `${i.type}/${i.id}` === `${fieldId}/${fieldRelValue.data.id}`);
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

  private async buildCardModelSchema(card: SingleResourceDoc) {
    if (!card.data.id) { return; }

    let cardModelSchema: ResourceObject[] = [];
    let schema = await this.currentSchema.getSchema();

    for (let resource of (card.included || [])) {
      if (resource.type === 'cards' || !schema.isSchemaType(resource.type)) { continue; }
      cardModelSchema.push(resource);
    }

    let { repository, packageName } = cardContextFromId(card.data.id);
    let defaultIncludes = (card.included || []).filter(i =>
      // field is not yet in the schema, so we'll need to introspect the field document for this
      (i.type === 'fields' || i.type === 'computed-fields') &&
      get(i, 'attributes.is-metadata')
      // not checking field-type, as that precludes using computed relationships for meta
      // which should be allowed. this will result in adding attr fields here, but that should be harmless
    ).map(i => (i.id || '').split(cardIdDelimiter).pop()) as string[];

    let modelContentType: ResourceObject = {
      type: 'content-types',
      id: cardContextToId({ repository, packageName }),
      attributes: {
        // we'll default includes all the metadata fields, and let adoptCardToFormat()
        // control presence of included resources based on requested format
        'default-includes': defaultIncludes
      },
      relationships: {
        fields: get(card, 'data.relationships.fields') || []
      }
    };
    cardModelSchema.push(modelContentType);

    return cardModelSchema;
  }
});
