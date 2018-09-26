const { get, isEqual, intersection } = require('lodash');

module.exports = class Group {
  constructor(model, allFields) {
    let searchQuery = get(model, 'attributes.search-query');
    if (!searchQuery) {
      throw new Error(`group must have a search-query attribute: ${JSON.stringify(model, null, 2)}`);
    }
    let types = get(searchQuery, 'filter.type.exact');
    if (!types) {
      throw new Error(`group ${model.id} search-query is required to filter by exact types: ${JSON.stringify(searchQuery, null, 2)}`);
    }
    if (!Array.isArray(types)) {
      types = [types];
    }
    this.types = types;

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
    this._fieldFilters = fieldFilters;
    this._allFields = allFields;
    this.id = model.id;
  }

  test(document) {
    let change = { finalDocument: document };
    return [...this._fieldFilters.entries()].every(([fieldName, allowedValues]) => {
      let field = this._allFields.get(fieldName);
      // TODO: this will be better using the Model API that's so far
      // only on the computed fields branch. When that is ready we can
      // update.
      let haveValue = field.valueFrom(change);
      if (Array.isArray(haveValue) && field.fieldType === '@cardstack/core-types::string-array') {
        return Boolean(intersection(allowedValues, haveValue).length);
      } else {
        return allowedValues.find(v => isEqual(v, haveValue));
      }
    });
  }

};
