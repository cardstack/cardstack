const {
  get,
  isEqual,
  intersection
} = require('lodash');

module.exports = class Group {
  constructor(model, allFields, allComputedFields) {
    if (model.type === 'groups' && model.id === 'everyone') {
      // Skip validation for the `everyone` group. All users get assigned this group.
      // See also bootstrap-schema.js and everyone-group.js for special handling.
      this.id = model.id;
      this.types = []; // required for downstream typechecks
    } else {
      let searchQuery = get(model, 'attributes.search-query');
      this.types = validatedTypes(searchQuery, model);
      this._allFields = new Map([...allFields, ...allComputedFields]);
      this._fieldFilters = validatedFieldFilters(this._allFields,  searchQuery, model);
      this.id = model.id;
    }
  }

  async test(documentContext) {
    let model = documentContext.model;
    return (await Promise.all([...this._fieldFilters.entries()].map(async ([fieldName, allowedValues]) => {
      let field = this._allFields.get(fieldName);
      let haveValue = await model.getField(fieldName);
      if (Array.isArray(haveValue) && field.fieldType === '@cardstack/core-types::string-array') {
        return Boolean(intersection(allowedValues, haveValue).length);
      } else {
        return allowedValues.find(v => isEqual(v, haveValue));
      }
    }))).every(Boolean);
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
