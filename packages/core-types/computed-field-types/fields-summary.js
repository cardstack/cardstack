const { merge } = require('lodash');

const summaryFieldKey = {
  internal: 'internal-fields-summary',
  embedded: 'embedded-metadata-summary',
  isolated: 'metadata-summary'
};

exports.type = '@cardstack/core-types::object';
const cardIdDelim = '::';

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
    let cardIdentifiers = field.id.split(cardIdDelim);
    let fieldName = cardIdentifiers.pop();
    let source = cardIdentifiers.join(cardIdDelim);
    let isComputed = field.type === 'computed-fields';
    let label = await field.getField('caption') || fieldName;
    let neededWhenEmbedded = await field.getField('needed-when-embedded');
    let instructions = await field.getField('instructions');

    // TODO we'll want to add all the items that the Field class from the data service consumes here
    fieldSummaries[fieldName] = {
      type,
      label,
      source,
      instructions,
      neededWhenEmbedded,
      isComputed
    };
  }

  let adoptedCard = await model.getRelated('adopted-from');
  if (adoptedCard) {
    let adoptedFields = await adoptedCard.getField(summaryFieldKey[format]) || {};
    for (let field of Object.keys(adoptedFields || {})) {
      adoptedFields[field].isAdopted = true;
    }
    fieldSummaries = merge({}, adoptedFields, fieldSummaries);
  }

  return fieldSummaries;
};