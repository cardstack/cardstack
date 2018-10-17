module.exports = function() {
  return [{
    type: 'content-types',
    id: 'spaces',
    attributes: {
      'default-includes': ['primary-card'],
      'fieldset-expansion-format': 'isolated',
      fieldsets: {
        isolated: [{
          field: 'primary-card', format: 'isolated'
        }],
      }
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'primary-card' },
          { type: 'fields', id: 'url-segment' }
        ]
      }
    }
  },
  {
    type: 'fields',
    id: 'primary-card',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    }
  },
  {
    type: 'fields',
    id: 'url-segment',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  }];
};
