exports.type = '@cardstack/core-types::belongs-to';

exports.compute = async function(model, { type, id }) {
  return { type, id };
};
