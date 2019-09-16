exports.type = '@cardstack/core-types::string-array';

exports.compute = async function(model) {
  let tags = await model.getRelated('local-hub::article-card::millenial-puppies::tags');
  return tags.map(i => i.id.split('::').pop());
};