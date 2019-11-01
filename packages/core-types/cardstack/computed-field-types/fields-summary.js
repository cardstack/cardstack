const { merge } = require('lodash');

const summaryFieldKey = {
  internal: 'internal-fields-summary',
  embedded: 'embedded-metadata-summary',
  isolated: 'metadata-summary'
};

exports.type = '@cardstack/core-types::object';

exports.compute = async function(model, { format }) {
  let fields = await model.getRelated('fields');
  if (!fields) { return {}; }

  let fieldSummaries = {};
  for (let field of fields) {
    let fieldSchema = field.schema.getRealAndComputedField(field.id);
    if (!fieldSchema) { continue; }
    if (format === 'internal' && await field.getField('is-metadata')) { continue; }
    if (format === 'embedded' && (!(await field.getField('is-metadata')) || !(await field.getField('needed-when-embedded')))) { continue; }

    let type = fieldSchema.fieldType;
    let fieldName = field.id.split('::').pop();
    let label = await field.getField('caption') || fieldName;
    let isComputed = field.type === 'computed-fields';

    // TODO we'll want to add all the items that the Field class from the data service consumes here

    fieldSummaries[fieldName] = { type , label, isComputed };
  }

  let adoptedCard = await model.getRelated('adopted-from');
  if (adoptedCard) {
    let adoptedFields = await adoptedCard.getField(summaryFieldKey[format]) || {};
    fieldSummaries = merge({}, fieldSummaries, adoptedFields);
  }

  return fieldSummaries;
};