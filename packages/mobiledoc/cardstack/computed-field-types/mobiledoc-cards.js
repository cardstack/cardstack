const { uniqBy } = require('lodash');
const { pluralize } = require('inflection');

exports.type = '@cardstack/core-types::has-many';

exports.compute = async function(model, { mobiledocFields }) {
  if (!mobiledocFields || !mobiledocFields.length ) { return; }

  let cards = [];
  for (let mobiledocField of mobiledocFields) {
    let mobiledoc = await model.getField(mobiledocField);
    if (!mobiledoc) { continue; }

    let documentCards = mobiledoc.cards;
    let cardstackCards = documentCards.filter(([cardName]) => cardName === 'cs-mobiledoc-card');
    let cardReferences = cardstackCards.map(([,payload]) => {
      let { id, type } = payload.card || {};
      type = pluralize(type);
      return { id, type };
    });
    cards = cards.concat(cardReferences);
  }

  return uniqBy(cards, card => `${card.type}/${card.id}`);
};
