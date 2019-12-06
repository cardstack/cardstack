exports.type = '@cardstack/core-types::belongs-to';

exports.compute = async function(model, { relationshipType, field, toLowerCase }) {
  if (!relationshipType) {
    return;
  }

  let id = await model.getField(field);
  if (!id) {
    return;
  }

  if (toLowerCase) {
    id = id.toLowerCase();
  }

  return { type: relationshipType, id };
};
