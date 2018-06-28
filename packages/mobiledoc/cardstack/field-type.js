const TextRenderer = require('mobiledoc-text-renderer').default;
const renderer = new TextRenderer({ cards: [] });

module.exports = {
  valid(value) {
    return typeof value === 'object' && value.hasOwnProperty('version');
  },



  // derive a text representation to store in elasticsearch
  derivedFields(fieldName, value) {
    return {
      [(fieldName)]: value ? renderer.render(value).result : null
    };
  },

  // the search mapping for our derived field
  derivedMappings(fieldName) {
    return {
      [(fieldName)]: { type: 'text' }
    };
  },

};
