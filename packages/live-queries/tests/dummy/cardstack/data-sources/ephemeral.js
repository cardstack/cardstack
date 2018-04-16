/* eslint-env node */

module.exports = [
  {
    type: 'grants',
    id: '0',
    attributes: {
      'may-read-fields': true,
      'may-write-fields': true,
      'may-create-resource': true,
      'may-read-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true,
      'may-login': true
    },
    relationships: {
      who: {
        data: { type: 'groups', id: 'everyone' }
      }
    }
  },{
    type: 'fields',
    id: 'content',
    attributes: {
      'field-type': '@cardstack/core-types::string'
    }
  },{
    type: 'content-types',
    id: 'items',
    relationships: {
      fields: {
        data: [
          { type: 'fields', id: 'content' }
        ]
      }
    }
  },{
    type: 'plugin-configs',
    id: '@cardstack/ephemeral'
  },{
    type: 'plugin-configs',
    id: '@cardstack/live-queries',
    attributes: {
      'socket-namespace': 'live-queries',
      'socket-path': '/',
      'socket-port': 3200
    }
  },
  {
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/ephemeral',
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'default' }
      }
    }
  }
];
