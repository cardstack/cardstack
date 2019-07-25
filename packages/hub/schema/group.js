const {
  get,
  isEqual,
  intersection
} = require('lodash');

module.exports = class Group {
  constructor(model, allFields) {
    if (model.type === 'groups' && model.id === 'everyone') {
      // Skip validation for the `everyone` group. All users get assigned this group.
      // See also bootstrap-schema.js and everyone-group.js for special handling.
      this.id = model.id;
      this.types = []; // required for downstream typechecks
    } else {
      let searchQuery = get(model, 'attributes.search-query');
      this.types = validatedTypes(searchQuery, model);
      this._fieldFilters = validatedFieldFilters(allFields,  searchQuery, model);
      this._allFields = allFields;
      this.id = model.id;
    }
  }

  test(document) {
    let change = {
      finalDocument: document
    };
    return [...this._fieldFilters.entries()].every(([fieldName, allowedValues]) => {
      let field = this._allFields.get(fieldName);
      // TODO: update this to use Model.getField() as we do in Grant.readRealmsFromField
      // https://github.com/cardstack/cardstack/issues/745
      let haveValue = field.valueFrom(change);
      if (Array.isArray(haveValue) && field.fieldType === '@cardstack/core-types::string-array') {
        return Boolean(intersection(allowedValues, haveValue).length);
      } else {
        return allowedValues.find(v => isEqual(v, haveValue));
      }
    });
  }
};

const validatedFieldFilters = function(allFields,  searchQuery, model) {
  let fieldFilters = new Map();
  for (let [field, values] of Object.entries(searchQuery.filter)) {
    if (field === 'type') {
      continue;
    }
    if (!allFields.has(field)) {
      throw new Error(`group ${model.id}'s search query is targeting unknown field ${field}: ${JSON.stringify(searchQuery, null, 2)}`);
    }
    if (!values.exact) {
      throw new Error(`group ${model.id}'s search query must use an exact filter for field ${field}: ${JSON.stringify(searchQuery, null, 2)}`);
    }
    if (Array.isArray(values.exact)) {
      fieldFilters.set(field, values.exact);
    } else {
      fieldFilters.set(field, [values.exact]);
    }
  }
  return fieldFilters;
};

const validatedTypes = function (searchQuery, model) {
  let types = get(searchQuery, 'filter.type.exact');
  if (!searchQuery) {
    throw new Error(`group must have a search-query attribute: ${JSON.stringify(model, null, 2)}`);
  }
  if (!types) {
    throw new Error(`group ${model.id} search-query is required to filter by exact types: ${JSON.stringify(searchQuery, null, 2)}`);
  }
  if (!Array.isArray(types)) {
    types = [types];
  }
  return types;
};
