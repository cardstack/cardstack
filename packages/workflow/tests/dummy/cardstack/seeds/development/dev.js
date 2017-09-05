/* eslint-env node */

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'messages')
    .withRelated('fields', [
      initial.addResource('fields', 'status').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'priority').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'tag').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'is-handled').withAttributes({
        fieldType: '@cardstack/core-types::boolean'
      }),
    ]);
  //TODO: Can we get the exported priority names here?
  initial.addResource('messages', '1')
    .withAttributes({
      status: 'pending',
      priority: 'Need Response',
      tag: 'Request to publish live',
      isHandled: false,
    });
  initial.addResource('messages', '2')
    .withAttributes({
      status: 'approved', // CueCard prop
      priority: 'Need Response',
      tag: 'Request to publish live',
      isHandled: false,
    });
  initial.addResource('messages', '3')
    .withAttributes({
      status: 'denied',
      priority: 'Need Response',
      tag: 'Ready for copyediting',
      isHandled: false,
    });
  initial.addResource('messages', '4')
    .withAttributes({
      status: 'approved',
      priority: 'Automatically processed',
      tag: 'Course information synced',
      isHandled: true,
    });
  return initial.getModels();
}

module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 0 }
      }
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/ephemeral',
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/jsonapi',
  },
  {
    type: 'data-sources',
    id: 0,
    attributes: {
      'source-type': '@cardstack/ephemeral',
      params: {
        initialModels: initialModels()
      }
    }
  },
  {
    type: 'grants',
    id: 0,
    attributes: {
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true,
      'may-write-field': true
    }
  }
];
