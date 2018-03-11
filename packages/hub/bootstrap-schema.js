const featureTypes = require('./plugin-loader').types();

const models = [
  {
    /* This is the content-type content-type. Mindblown. */
    type: 'content-types',
    id: 'content-types',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'data-source' },
          { type: 'fields', id: 'fields' },
          { type: 'fields', id: 'is-built-in' },
          { type: 'fields', id: 'routing-field' },
          { type: 'fields', id: 'default-includes' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'fields',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'field-type' },
          { type: 'fields', id: 'related-types' },
          { type: 'fields', id: 'default-at-create' },
          { type: 'fields', id: 'default-at-update' },
          { type: 'fields', id: 'caption' },
          { type: 'fields', id: 'editor-component'},
          { type: 'fields', id: 'inline-editor-component'}
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'constraints',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'constraint-type' },
          { type: 'fields', id: 'inputs' },
          { type: 'fields', id: 'input-assignments' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'default-values',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'value' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'grants',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'who' },
          { type: 'fields', id: 'may-create-resource' },
          { type: 'fields', id: 'may-read-resource' },
          { type: 'fields', id: 'may-update-resource' },
          { type: 'fields', id: 'may-delete-resource' },
          { type: 'fields', id: 'may-read-fields' },
          { type: 'fields', id: 'may-write-fields' },
          { type: 'fields', id: 'types' },
          { type: 'fields', id: 'fields' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'plugins',
    attributes: {
      'is-built-in': true,
      'default-includes': ['features']
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'features' },
          { type: 'fields', id: 'enabled' }
        ]
      },
      'data-source': {
        data: { type: 'data-sources', id: 'plugins' }
      }
    }
  },
  {
    type: 'content-types',
    id: 'plugin-configs',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'enabled' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'data-sources',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'source-type' },
          { type: 'fields', id: 'params' },
          { type: 'fields', id: 'user-template' },
          { type: 'fields', id: 'user-correlation-query' },
          { type: 'fields', id: 'may-create-user' },
          { type: 'fields', id: 'may-update-user' },
          { type: 'fields', id: 'token-expiry-seconds' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'message-sinks',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'messenger-type' },
          { type: 'fields', id: 'params' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'groups',
    attributes: {
      'is-built-in': true
    }
  },
  {
    type: 'content-types',
    id: 'input-assignments',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'input-name' },
          { type: 'fields', id: 'field' }
        ]
      }
    }
  },
  {
    type: 'fields',
    id: 'input-name',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'routing-field',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'searchable-relationships',
    attributes: {
      'field-type': '@cardstack/core-types::string-array'
    }
  },
  {
    type: 'fields',
    id: 'default-includes',
    attributes: {
      'field-type': '@cardstack/core-types::string-array'
    }
  },
  {
    type: 'fields',
    id: 'may-create-user',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'may-update-user',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'token-expiry-seconds',
    attributes: {
      'field-type': '@cardstack/core-types::integer'
    }
  },
  {
    type: 'fields',
    id: 'source-type',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'messenger-type',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'user-template',
    attributes: {
      'field-type': '@cardstack/handlebars'
    }
  },
  {
    type: 'fields',
    id: 'user-correlation-query',
    attributes: {
      'field-type': '@cardstack/handlebars'
    }
  },
  {
    type: 'fields',
    id: 'type',
    attributes: {
      'field-type': '@cardstack/core-types::type'
    }
  },
  {
    type: 'fields',
    id: 'types',
    attributes: {
      'field-type': '@cardstack/core-types::has-many'
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'content-types' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'who',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'groups' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'id',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'is-built-in',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'params',
    attributes: {
      'field-type': '@cardstack/core-types::object'
    }
  },
  {
    type: 'fields',
    id: 'group-id',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'value',
    attributes: {
      'field-type': '@cardstack/core-types::any'
    }
  },
  {
    type: 'fields',
    id: 'constraint-type',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'default-at-create',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'default-values' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'default-at-update',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'default-values' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'field-type',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'caption',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'editor-component',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'inline-editor-component',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'fields',
    attributes: {
      'field-type': '@cardstack/core-types::has-many',
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'fields' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'field',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to',
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'fields' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'inputs',
    attributes: {
      'field-type': '@cardstack/core-types::object',
    }
  },
  {
    type: 'fields',
    id: 'input-assignments',
    attributes: {
      'field-type': '@cardstack/core-types::has-many',
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'input-assignments' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'related-types',
    attributes: {
      'field-type': '@cardstack/core-types::has-many',
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'content-types' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'data-source',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'data-sources' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'may-create-resource',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'may-read-resource',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'may-update-resource',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'may-delete-resource',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'may-read-fields',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'may-write-fields',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'fields',
    id: 'plugin',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    },
    relationships: {
      'related-types': {
        data: [{ type: 'content-types', id: 'plugins' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'load-path',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },
  {
    type: 'fields',
    id: 'features',
    attributes: {
      'field-type': '@cardstack/core-types::has-many'
    }
  },
  {
    type: 'fields',
    id: 'enabled',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
    }
  },
  {
    type: 'grants',
    id: 'hub-internal-grant',
    attributes: {
      'may-read-fields': true,
      'may-write-fields': true,
      'may-create-resource': true,
      'may-read-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true
    },
    relationships: {
      who: {
        data: { type: 'groups', id: '@cardstack/hub' }
      }
    }
  },
  {
    type: 'data-sources',
    id: 'plugins',
    attributes: {
      'source-type': '@cardstack/hub::plugins'
    }
  },
  {
    type: 'data-sources',
    id: 'initial-models',
    attributes: {
      'source-type': '@cardstack/hub::initial-models'
    }
  }

];

module.exports = models.concat(featureTypes.map(type => ({
  type: 'content-types',
  id: type,
  attributes: {
    'is-built-in': true
  },
  relationships: {
    fields: {
      data: [
        { type: 'fields', id: 'load-path' },
        { type: 'fields', id: 'plugin' }
      ]
    },
    'data-source': {
      data: { type: 'data-sources', id: 'plugins' }
    }
  }
})));
