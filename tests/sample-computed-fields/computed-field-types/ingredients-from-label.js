exports.type = '@cardstack/core-types::has-many';

exports.compute = async function(model) {
  let ingredientsLabel = await model.getField('ingredients-label');
  if (!ingredientsLabel) {
    return [];
  }

  return ingredientsLabel.split(',').map(i => {
    return { type: 'foods', id: i.trim() };
  });
};
