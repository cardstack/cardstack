const { cardContextToId, cardContextFromId } = require('@cardstack/plugin-utils/card-context');

exports.type = '@cardstack/core-types::belongs-to';

exports.compute = async function(model) {
  let { sourceId, packageName, cardId } = cardContextFromId(model.id);
  if (sourceId == null || packageName == null || cardId == null) { return; }

  let id = cardContextToId({ sourceId, packageName, cardId });
  return { type: 'cards', id };
};