exports.type = '@cardstack/core-types::has-many';

exports.compute = async function(model) {
  let color = await model.getField('color');
  let groceryList = await model.getRelated('grocery-list');
  if (!groceryList) { return []; }

  let sameColor = [];
  for (let otherModel of groceryList) {
    let otherColor = await otherModel.getField('color');
    if (otherColor === color && otherModel.id !== model.id) {
      sameColor.push({ type: otherModel.type, id: otherModel.id });
    }
  }
  return sameColor.sort((a, b) => (a.id > b.id) ? 1 : -1);
};
