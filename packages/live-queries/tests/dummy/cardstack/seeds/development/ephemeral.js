/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

module.exports = [
  {
    type: 'grants',
    id: '0',
    attributes: {
      'may-write-field': true,
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true
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
      params: {
        initialModels: initialModels()
      }
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

function initialModels() {
  let factory = new JSONAPIFactory();

  factory.addResource('items')
    .withAttributes({
      content: 'hello'
    });

  return factory.getModels()
}
