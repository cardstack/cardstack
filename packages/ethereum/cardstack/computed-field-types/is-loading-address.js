exports.type = '@cardstack/core-types::boolean';

exports.compute = async function(model) {
  let address = await model.getRelated('address-data');
  if (!address) { return true; }

  let meta = address.getMeta();

  return Boolean(meta && meta.loadingTransactions);
};