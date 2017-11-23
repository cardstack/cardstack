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
          { type: 'fields', id: 'may-update-resource' },
          { type: 'fields', id: 'may-delete-resource' },
          { type: 'fields', id: 'may-write-field' },
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
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'routing-field',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'searchable-relationships',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string-array' }
      }
    }
  },
  {
    type: 'fields',
    id: 'default-includes',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string-array' }
      }
    }
  },
  {
    type: 'fields',
    id: 'may-create-user',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'may-update-user',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'token-expiry-seconds',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::integer' }
      }
    }
  },
  {
    type: 'fields',
    id: 'source-type',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'messenger-type',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'user-template',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/handlebars' }
      }
    }
  },
  {
    type: 'fields',
    id: 'type',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::type' }
      }
    }
  },
  {
    type: 'fields',
    id: 'types',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::has-many' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'content-types' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'who',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'groups' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'id',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'is-built-in',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'params',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::object' }
      }
    }
  },
  {
    type: 'fields',
    id: 'group-id',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'value',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::any' }
      }
    }
  },
  {
    type: 'fields',
    id: 'constraint-type',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'default-at-create',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'default-values' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'default-at-update',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'default-values' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'field-type',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'field-types' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'caption',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'editor-component',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'inline-editor-component',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'fields',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::has-many' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'fields' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'field',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'fields' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'inputs',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::object' }
      }
    }
  },
  {
    type: 'fields',
    id: 'input-assignments',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::has-many' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'input-assignments' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'related-types',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::has-many' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'content-types' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'data-source',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'data-sources' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'may-create-resource',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'may-update-resource',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'may-delete-resource',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'may-write-field',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'fields',
    id: 'plugin',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::belongs-to' }
      },
      'related-types': {
        data: [{ type: 'content-types', id: 'plugins' }]
      }
    }
  },
  {
    type: 'fields',
    id: 'load-path',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::string' }
      }
    }
  },
  {
    type: 'fields',
    id: 'features',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::has-many' }
      }
    }
  },
  {
    type: 'fields',
    id: 'enabled',
    relationships: {
      'field-type': {
        data: { type: 'field-types', id: '@cardstack/core-types::boolean' }
      }
    }
  },
  {
    type: 'grants',
    id: '0',
    attributes: {
      'may-write-field': true,
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true
    },
    relationships: {
      who: {
        data: { type: 'users', id: '@cardstack/hub' }
      }
    }
  },
  {
    type: 'data-sources',
    id: 'plugins',
    attributes: {
      'source-type': '@cardstack/hub::plugins'
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
