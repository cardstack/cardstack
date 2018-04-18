module.exports = async function({ getField }, { sourceField, factor }) {
  return factor * (await getField(sourceField));
};
