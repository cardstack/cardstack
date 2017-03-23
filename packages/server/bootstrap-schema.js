const models = [
  {
    type: 'plugin-configs',
    id: 'core-types',
    attributes: {
      module: '@cardstack/core-types'
    }
  },
  {
    /* This is the content-type content-type. Mindblown. */
    type: 'content-types',
    id: 'content-types',
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'data-source' },
          { type: 'fields', id: 'fields' }
        ]
      }
    }
  },
  {
    type: 'content-types',
    id: 'fields',
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
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'group-id' },
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
    type: 'fields',
    id: 'source-type',
    attributes: {
      'field-type': '@cardstack/core-types::string'
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
  }

];
module.exports = models;
