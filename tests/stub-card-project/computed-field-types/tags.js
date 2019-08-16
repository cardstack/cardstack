exports.type = '@cardstack/core-types::string-array';

exports.compute = async function(model) {
  let tags = await model.getRelated('tags');
  return tags.map(i => i.id.split('::').pop());
};