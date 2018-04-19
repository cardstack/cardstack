exports.type = '@cardstack/core-types::integer';

exports.compute = async function({ field }, { sourceField, factor }) {
  return factor * await field(sourceField);
};
