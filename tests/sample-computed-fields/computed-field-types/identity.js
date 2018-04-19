exports.type = function({ typeOf }, { sourceField }) {
  return typeOf(sourceField);
};

exports.compute = async function({ field }, { sourceField }) {
  return await field(sourceField);
};
