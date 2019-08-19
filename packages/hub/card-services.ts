import Error from '@cardstack/plugin-utils/error';
import Session from '@cardstack/plugin-utils/session';
import {
  cardContextFromId,
  cardContextToId,
  cardIdDelimiter
} from '@cardstack/plugin-utils/card-context';
import { declareInjections } from '@cardstack/di';
import { todo } from '@cardstack/plugin-utils/todo-any';
import {
  SingleResourceDoc,
  ResourceObject,
  ResourceIdentifierObject,
  CollectionResourceDoc,
  ResourceLinkage
} from 'jsonapi-typescript';
import { get, set, uniqBy } from 'lodash';

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
    if (!card.data.id) { throw new Error(`Cannot load card with missing id.`, { status: 400 }); }
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

    await this.validate(card);

    let schemaModels = await this.buildCardModelSchema(card);
    if (!schemaModels) { return; }

    for (let model of schemaModels) {
      await this.writers.create(Session.INTERNAL_PRIVILEGED, model.type, { data: model });
    }
    await this.writers.create(Session.INTERNAL_PRIVILEGED, 'cards', card);

    let internalCardModels = await this.getInternalCardModels(card) || [];
    for (let model of internalCardModels) {
      await this.writers.create(Session.INTERNAL_PRIVILEGED, model.type, { data: model });
    }
  }

  async get(session: Session, id: string, format: string) {
    let rawCard = await this.searchers.get(session, 'local-hub', 'cards', id);
    let { repository, packageName } = cardContextFromId(id);
    let cardModelType = cardContextToId({ repository, packageName });
    let model = await this.searchers.get(session, 'local-hub', cardModelType, id, { format });

    let card = await this.adaptCardToFormat(rawCard, model, format, session);
    card.included = uniqBy(card.included, i => `${i.type}/${i.id}`);
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

  private async validate(card: SingleResourceDoc) {
    if (!card.data.id) { throw new Error(`Invalid card: missing id.`, { status: 400, source: { pointer: 'data/id'} }); }
    let id = card.data.id;

    let { repository, packageName } = cardContextFromId(id);
    let fields: ResourceIdentifierObject[] = get(card, 'data.relationships.fields.data') || [];
    let foreignSchema = fields.find(i => {
      let { repository:fieldRepo, packageName:fieldPkg } = cardContextFromId(i.id);
      return fieldRepo !== repository || fieldPkg !== packageName;
    });
    if (foreignSchema) {
      throw new Error(`Invalid card 'cards/${card.data.id}', card contains foreign schema '${foreignSchema.type}/${foreignSchema.id}'`, { status: 400, source: { pointer: `data/relationships/fields`} });
    }

    let modelRef: ResourceIdentifierObject = get(card, 'data.relationships.model.data');
    if (modelRef) {
      if (!modelRef.id) { throw new Error(`Invalid card: missing id included resource.`, { status: 400, source: { pointer: 'data/model/id' } }); }
      let { repository: resourceRepo, packageName: resourcePkg } = cardContextFromId(modelRef.type);
      if (resourceRepo !== repository || resourcePkg !== packageName) {
        throw new Error(`Invalid card 'cards/${card.data.id}', card contains foreign schema '${modelRef.type}/${modelRef.id}'`, { status: 400, source: { pointer: `data/relationships/model`} });
      }
      if (modelRef.id !== card.data.id) {
        throw new Error(`Invalid card 'cards/${card.data.id}', card contains foreign model '${modelRef.type}/${modelRef.id}'`, { status: 400, source: { pointer: `data/relationships/model`} });
      }
    }

    let schema = await this.currentSchema.getSchema();
    let model = (card.included || []).find(i => `${modelRef.type}/${modelRef.id}` === `${i.type}/${i.id}`);
    if (model) {
      this.validateResource(schema, card, model); // TODO we should guard for cycles in relationships in included resources
    }
  }

  private validateResource(schema: todo, card: SingleResourceDoc, resource: ResourceObject) {
    if (!card.data.id) { throw new Error(`Invalid card: missing id.`, { status: 400, source: { pointer: 'data/id'} }); }
    let id = card.data.id;
    let { repository, packageName } = cardContextFromId(id);
    if (!resource.id) { throw new Error(`Invalid card: missing id included resource.`, { status: 400, source: { pointer: 'included/id' } }); }

    let { repository: typeRepo, packageName: typePkg } = cardContextFromId(resource.type);
    let { repository: idRepo, packageName: idPkg } = cardContextFromId(resource.id);
    if (resource.type !== 'cards' && !schema.isSchemaType(resource.type)) {
      if (idRepo !== repository ||
        idPkg !== packageName ||
        typeRepo !== repository ||
        typePkg !== packageName) {
        throw new Error(`Invalid card 'cards/${card.data.id}', card contains foreign model '${resource.type}/${resource.id}'`, { status: 400, source: { pointer: `included/[${resource.type}/${resource.id}]` } });
      }
      this.validateRelationships(schema, card, resource);
    } else {
      if (idRepo !== repository || idPkg !== packageName) {
        throw new Error(`Invalid card 'cards/${card.data.id}', card contains foreign schema '${resource.type}/${resource.id}'`, { status: 400, source: { pointer: `included/[${resource.type}/${resource.id}]` } });
      }
    }
  }

  private validateRelationships(schema: todo, card: SingleResourceDoc, resource: ResourceObject) {
    for (let relationshipName of Object.keys(resource.relationships || {})) {
      let relationship = get(resource, `relationships.${relationshipName}.data`);
      if (!relationship) { continue; }
      if (Array.isArray(relationship)) {
        for (let ref of relationship) {
          this.validateRelationshipRef(schema, card, resource, ref, relationshipName);
          if (!schema.isSchemaType(ref.type) && ref.type !== 'cards') {
            let related = (card.included || []).find(i => `${ref.type}/${ref.id}` === `${i.type}/${i.id}`);
            if (related) {
              this.validateResource(schema, card, related);
            }
          }
        }
      } else {
        this.validateRelationshipRef(schema, card, resource, relationship, relationshipName);
        if (!schema.isSchemaType(relationship.type) && relationship.type !== 'cards') {
          let related = (card.included || []).find(i => `${relationship.type}/${relationship.id}` === `${i.type}/${i.id}`);
          if (related) {
            this.validateResource(schema, card, related);
          }
        }
      }
    }
  }

  private validateRelationshipRef(schema: todo, card: SingleResourceDoc, resource: ResourceObject, ref: ResourceIdentifierObject, relationshipName: string) {
    if (!card.data.id) { throw new Error(`Invalid card: missing id.`, { status: 400, source: { pointer: 'data/id'} }); }
    let id = card.data.id;
    let { repository, packageName, cardId:instanceId } = cardContextFromId(id);
    if (!schema.isSchemaType(ref.type) && ref.type !== 'cards') {
      let { repository: typeRepo, packageName: typePkg } = cardContextFromId(ref.type);
      if (typeRepo !== repository || typePkg !== packageName) {
        throw new Error(`Invalid card 'cards/${card.data.id}', card contains foreign schema '${ref.type}/${ref.id}'`, { status: 400, source: { pointer: `included/[${resource.type}/${resource.id}]/relationships/${relationshipName}` } });
      }
    }
    if (ref.type !== 'cards') {
      let { repository: idRepo, packageName: idPkg, cardId } = cardContextFromId(ref.id);
      if (idRepo !== repository || idPkg !== packageName || cardId !== instanceId) {
        throw new Error(`Invalid card 'cards/${card.data.id}', card contains relationship to internal model of foreign card '${ref.type}/${ref.id}'`, { status: 400, source: { pointer: `included/[${resource.type}/${resource.id}]/relationships/${relationshipName}` } });
      }
    }
  }

  private async getInternalCardModels(card: SingleResourceDoc) {
    if (!card.data.id) { return; }
    let { repository, packageName } = cardContextFromId(card.data.id);
    let cardModels: ResourceObject[] = [];
    let schema = await this.currentSchema.getSchema();

    for (let resource of (card.included || [])) {
      if (!resource.id) { continue; }
      if (resource.type === 'cards' || schema.isSchemaType(resource.type)) { continue; }
      let { repository: resourceRepo, packageName: resourcePkg } = cardContextFromId(resource.id);
      if (repository === resourceRepo && packageName === resourcePkg) {
        cardModels.push(resource);
      }
    }

    return cardModels;
  }

  private async adaptCardToFormat(card: SingleResourceDoc, model: SingleResourceDoc, format: string, session: Session) {
    if (!model.data.type || !model.data.id) { throw new Error(`Card model is missing type and/or id '${model.data.type}/${model.data.id}'`, { status: 400 }); }
    if (!card.data.attributes) { throw new Error(`Card is missing attributes '${card.data.type}/${card.data.id}`, { status: 400 }); }

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
        let fieldAttrValue = get(model, `data.attributes.${field.name}`) as todo;
        let fieldRelValue = get(model, `data.relationships.${field.name}.data`) as ResourceLinkage;

        if (!field.isRelationship && fieldAttrValue !== undefined && result.data.attributes) {
          result.data.attributes[field.name] = fieldAttrValue;
        } else if (field.isRelationship && fieldRelValue !== undefined && result.data.relationships && result.included) {
          set(result, `data.relationships.${field.name}.data`, Array.isArray(fieldRelValue) ? [].concat(fieldRelValue as []) : Object.assign({}, fieldRelValue));
          let includedResources: ResourceObject[] = [];
          await this.resolveIncludedRelationship(fieldRelValue, session, model.included || [], includedResources);
          result.included = result.included.concat(includedResources);
        }
      }
    }

    return result;
  }

  private async resolveIncludedRelationship(
    fieldRef: ResourceLinkage,
    session: Session,
    resources: ResourceObject[],
    resolvedIncluded: ResourceObject[]
  ) {
    if (Array.isArray(fieldRef)) {
      for (let { type, id } of fieldRef) {
        await this.processRef(session, type, id, resources, resolvedIncluded);
      }
    } else if (fieldRef) {
      let { type, id } = fieldRef;
      await this.processRef(session, type, id, resources, resolvedIncluded);
    }
  }

  private async processRef(session: Session, type: string, id: string, resources: ResourceObject[], included: ResourceObject[]) {
    if (type === 'cards') {
      let embeddedCard: ResourceObject | undefined, embeddedIncluded: ResourceObject[] = [];
      try {
        let card = await this.get(session, id, 'embedded') as SingleResourceDoc;
        embeddedCard = card.data;
        // For embedded cards dont include their schemas or models--just the card document itself
        // and any related embedded cards the embedded card has.
        embeddedIncluded = (card.included || []).filter(i => i.type === 'cards');
      } catch (e) {
        if (e.status !== 404) { throw e; }
      }
      if (embeddedCard) {
        included.push(embeddedCard);
      }
      if (embeddedIncluded.length) {
        for (let { id:embeddedId } of embeddedIncluded) {
          if (!embeddedId) { continue; }
          await this.processRef(session, 'cards', embeddedId, embeddedIncluded, included);
        }
      }
    } else {
      let resource = resources.find((i: ResourceObject) => `${type}/${id}` === `${i.type}/${i.id}`);
      resource && included.push(resource);
    }
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
    let { repository, packageName } = cardContextFromId(card.data.id);

    for (let resource of (card.included || [])) {
      if (!resource.id) { continue; }
      if (!schema.isSchemaType(resource.type) && resource.type !== 'cards') { continue; }
      let { repository:resourceRepo, packageName:resourcePkg } = cardContextFromId(resource.id);
      if (resource.type === 'cards' &&
        (repository !== resourceRepo || packageName !== resourcePkg)) {
        await this.loadCard({ data: resource, included: card.included}); // TODO we should really clean up this included
        continue;
      }

      if (resource.type !== 'cards' &&
        repository === resourceRepo &&
        packageName === resourcePkg) {
        cardModelSchema.push(resource);
      }
    }

    let fields = (get(card, 'data.relationships.fields.data') || []) as ResourceIdentifierObject[];
    let defaultIncludes = fields.filter((i: ResourceIdentifierObject) => {
      // field is not yet in the schema, so we'll need to introspect the field resource in included for this
      let field = (card.included || []).find(j => `${i.type}/${i.id}` === `${j.type}/${j.id}`);
      return get(field, 'attributes.is-metadata');
      // not checking field-type, as that precludes using computed relationships for meta
      // which should be allowed. this will result in adding attr fields here, but that should be harmless
    }).map((i: ResourceIdentifierObject) => (i.id || '').split(cardIdDelimiter).pop()) as string[];
    let modelContentType: ResourceObject = {
      type: 'content-types',
      id: cardContextToId({ repository, packageName }),
      attributes: {
        // we'll default includes all the metadata fields, and let adoptCardToFormat()
        // control presence of included resources based on requested format
        'default-includes': defaultIncludes,
      },
      relationships: {
        fields: { data: fields }
      }
    };
    cardModelSchema.push(modelContentType);

    return cardModelSchema;
  }
});
