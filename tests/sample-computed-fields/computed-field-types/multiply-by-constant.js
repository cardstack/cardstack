exports.type = '@cardstack/core-types::integer';

exports.compute = async function(model, { sourceField, factor }) {
  return factor * (await model.getField(sourceField));
};
