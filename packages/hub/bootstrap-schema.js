const models = [
  {
    type: 'plugin-configs',
    id: 'core-types',
    attributes: {
      module: '@cardstack/core-types'
    }
  },
  {
    type: 'plugin-configs',
    id: 'handlebars',
    attributes: {
      module: '@cardstack/handlebars'
    }
  },
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
          { type: 'fields', id: 'is-built-in' }
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
          { type: 'fields', id: 'constraints' },
          { type: 'fields', id: 'default-at-create' },
          { type: 'fields', id: 'default-at-update' }
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
          { type: 'fields', id: 'parameters' }
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
          { type: 'fields', id: 'may-write-field' }
        ]
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
          { type: 'fields', id: 'module' }
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
          { type: 'fields', id: 'params' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'authentication-sources',
    attributes: {
      'is-built-in': true
    },
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'authenticator-type' },
          { type: 'fields', id: 'params' },
          { type: 'fields', id: 'user-template' },
          { type: 'fields', id: 'may-create-user' },
          { type: 'fields', id: 'may-update-user' }
        ]
      }
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
    id: 'source-type',
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
    id: 'authenticator-type',
    attributes: {
      'field-type': '@cardstack/core-types::string'
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
    id: 'who',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
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
    id: 'module',
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
    }
  },
  {
    type: 'fields',
    id: 'default-at-update',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
    }
  },
  {
    type: 'fields',
    id: 'parameters',
    attributes: {
      'field-type': '@cardstack/core-types::object'
    }
  },
  {
    type: 'fields',
    id: 'constraints',
    attributes: {
      'field-type': '@cardstack/core-types::has-many'
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
    id: 'fields',
    attributes: {
      'field-type': '@cardstack/core-types::has-many',
    }
  },
  {
    type: 'fields',
    id: 'data-source',
    attributes: {
      'field-type': '@cardstack/core-types::belongs-to'
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
    id: 'may-write-field',
    attributes: {
      'field-type': '@cardstack/core-types::boolean'
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
  }

];
module.exports = models;
