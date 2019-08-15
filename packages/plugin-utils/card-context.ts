export interface CardContext {
  repository?: string;
  packageName?: string;
  cardId?: string;
  modelId?: string;
}

export const cardIdDelimiter = '::';

export function cardContextFromId(id: string) {
  let noContext: CardContext = {};
  if (!id) { return noContext; }

  let idParts = id.split(cardIdDelimiter);
  if (idParts.length <= 1) { return noContext; }

  let [repository, packageName, cardId, modelId] = idParts;
  let context: CardContext = {
    repository,
    packageName,
    cardId,
    modelId,
  };
  return context;
}

export function cardContextToId({ repository, packageName, cardId, modelId }: CardContext) {
  return [repository, packageName, cardId, modelId].filter(i => i != null).join(cardIdDelimiter);
}