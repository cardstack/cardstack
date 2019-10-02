exports.type = '@cardstack/core-types::object';

exports.compute = async function(model) {
  let fields = await model.getRelated('fields');
  if (!fields) { return {}; }

  let fieldTypes = {};
  for (let field of fields) {
    if (field.type !== 'fields') { continue; } // TODO eventually handle computed-fields
    if (!(await field.getField('is-metadata'))) { continue; }

    let fieldName = field.id.split('::').pop();
    let fieldType = await field.getField('field-type');
    fieldTypes[fieldName] = fieldType;
  }

  return fieldTypes;
};