exports.type = '@cardstack/core-types::integer';

const errorCardMapping = {
  'not-found': 404
};

exports.compute = async function(model) {
  let primaryCard = await model.getRelated('primary-card');
  let meta = primaryCard.getMeta();

  if (meta && meta['is-error-card']) {
    return errorCardMapping[primaryCard.getId()] || 500;
  }

  return 200;
};