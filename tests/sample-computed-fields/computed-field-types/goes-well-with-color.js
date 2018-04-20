exports.type = '@cardstack/core-types::boolean';

exports.compute = async function(model, { color }) {
  let otherFoods = await model.getRelated('goes-well-with');
  for (let otherModel of otherFoods) {
    let otherColor = await otherModel.getField('color');
    if (otherColor === color) {
      return true;
    }
  }
  return false;
};
