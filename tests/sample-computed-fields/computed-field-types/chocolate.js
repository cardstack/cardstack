exports.type = '@cardstack/core-types::belongs-to';

exports.compute = async function(model, { chocoId }) {
  return { type: 'foods', id: chocoId };
};
