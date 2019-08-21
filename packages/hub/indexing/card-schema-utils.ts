import { todo } from '@cardstack/plugin-utils/todo-any';
import { SingleResourceDoc, ResourceObject } from "jsonapi-typescript";
import { get } from 'lodash';

interface CardContext {
  repository: string;
  packageName: string;
  cardId?: string;
  modelId?: string;
}

const cardIdDelim = '::';

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

export = {
  schemaModelsForCard
}