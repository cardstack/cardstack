const { isCard, cardIdFromId } = require('@cardstack/plugin-utils/card-context');

exports.type = '@cardstack/core-types::belongs-to';

exports.compute = async function(model) {
  if (!isCard(model.id)) { return; }

  return { type: 'cards', id: cardIdFromId(model.id) };
};