async function resolvePath(model, pathSegments) {
  if (!model) { return; }

  if (!pathSegments.length) { return model; }

  if (pathSegments.length === 1) {
    let field = pathSegments[0];
    let contentType = model.getContentType();
    let isRelationship = contentType.realAndComputedFields.get(field).isRelationship;
    return isRelationship ? await model.getRelated(field) : await model.getField(field);
  }

  return await resolvePath(await model.getRelated(pathSegments[0]), pathSegments.slice(1));
}

exports.type = function(typeOf, { aliasPath }) {
  let pathSegments = aliasPath.split('.');
  return typeOf(pathSegments[pathSegments.length - 1]);
};

exports.compute = async function(model, { aliasPath, defaultValue }) {
  let value = await resolvePath(model, aliasPath.split('.'));
  if (value !== undefined) {
    return value;
  } else if (defaultValue !== undefined) {
    return defaultValue;
  }
};
