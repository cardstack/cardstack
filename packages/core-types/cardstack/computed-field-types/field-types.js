const { merge } = require('lodash');

exports.type = '@cardstack/core-types::object';

// TODO this contains more info than just "types", consider renaming this to "metadata-summary"?
exports.compute = async function(model, { format }) {
  let fields = await model.getRelated('fields');
  if (!fields) { return {}; }

  let fieldTypes = {};
  for (let field of fields) {
    if (field.type !== 'fields') { continue; } // TODO eventually handle computed-fields
    if (!(await field.getField('is-metadata')) ||
      (!(await field.getField('needed-when-embedded')) && format === 'embedded')
    ) { continue; }

    let fieldName = field.id.split('::').pop();
    let fieldType = await field.getField('field-type');
    let label = await field.getField('caption') || fieldName;
    fieldTypes[fieldName] = { type: fieldType, label };
  }

  let adoptedCard = await model.getRelated('adopted-from');
  if (adoptedCard) {
    let adoptedFields = await adoptedCard.getField(format === 'embedded' ? 'embedded-metadata-field-types': 'metadata-field-types') || {};
    fieldTypes = merge({}, fieldTypes, adoptedFields);
  }

  return fieldTypes;
};