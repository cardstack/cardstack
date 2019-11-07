exports.type = '@cardstack/core-types::string-array';

exports.compute = async function(model) {
  let adoptionChain = [];
  let currentCard = model;

  while (currentCard = await currentCard.getRelated('adopted-from')) { // eslint-disable-line no-cond-assign
    if (!currentCard) { break; }
    adoptionChain.push(currentCard.id);
  }
  return adoptionChain;
};