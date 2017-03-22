const TextRenderer = require('mobiledoc-text-renderer').default;
const renderer = new TextRenderer({ cards: [] });

module.exports = {
  valid(value) {
    return typeof value === 'object' && value.hasOwnProperty('version');
  },

  // our mobiledoc representation is not indexed.
  defaultMapping() {
    return {
      enabled: false
    };
  },

  // override the name of the field in elasticsearch that will be
  // targeted by search queries. In this case, we want to search the
  // text representation, not the canoical mobiledoc representation.
  queryFieldName(fieldName) {
    return `${fieldName}_as_text`;
  },

  // derive a text representation to store in elasticsearch
  derivedFields(fieldName, value) {
    return {
      [this.queryFieldName(fieldName)]: value ? renderer.render(value).result : null
    };
  },

  // the search mapping for our derived field
  derivedMappings(fieldName) {
    return {
      [this.queryFieldName(fieldName)]: { type: 'text' }
    };
  },

};
