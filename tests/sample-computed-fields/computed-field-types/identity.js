exports.type = function(typeOf, { sourceField }) {
  return typeOf(sourceField);
};

exports.compute = async function(model, { sourceField }) {
  return model.getField(sourceField);
};
