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
          { type: 'fields', id: 'query-params' },
          { type: 'computed-fields', id: 'http-status' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'application-cards',
  },
  {
    type: 'content-types',
    id: 'error-cards',
  },
  {
    type: 'grants',
    id: 'routing-grant',
    attributes: {
      'may-read-fields': true,
      'may-read-resource': true,
    },
    relationships: {
      who: {
        data: [{ type: 'groups', id: 'everyone' }]
      },
      types: {
        data: [
          { type: "content-types", id: 'spaces' },
          { type: "content-types", id: 'application-cards' },
          { type: "content-types", id: 'error-cards' }
        ]
      }
    }
  },
  {
    type: 'fields',
    id: 'status-code',
    attributes: {
      'field-type': '@cardstack/core-types::integer'
    }
  },
  {
    type: 'fields',
    id: 'message',
    attributes: {
      'field-type': '@cardstack/core-types::string'
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
    id: 'query-params',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'computed-fields',
    id: 'http-status',
    attributes: {
      'computed-field-type': '@cardstack/routing::http-status',
    }
  },
  {
    type: 'application-cards',
    id: 'getting-started'
  },
  {
    type: 'error-cards',
    id: 'not-found'
  },
  ];
};
