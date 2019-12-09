exports.type = '@cardstack/core-types::integer';

exports.compute = async function(
  model,
  { transferEvent, transferAddressField, transferAddressValue, transferAmountField }
) {
  let sum = 0;
  let transfers = await model.getRelated(transferEvent);

  for (let transfer of transfers) {
    let address = await transfer.getField(transferAddressField);
    if (!address || address.toLowerCase() !== transferAddressValue.toLowerCase()) {
      continue;
    }

    sum += parseInt((await transfer.getField(transferAmountField)) || 0, 10);
  }

  return sum;
};
