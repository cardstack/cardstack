exports.type = '@cardstack/core-types::integer';

exports.compute = async function({ getField }, { sourceField, factor }) {
  return factor * (await getField(sourceField));
};
