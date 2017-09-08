/* eslint-env node */
const moment = require('moment-timezone');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'messages')
    .withRelated('fields', [
      initial.addResource('fields', 'text').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
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
      initial.addResource('fields', 'updated-at').withAttributes({
        fieldType: '@cardstack/core-types::date'
      }),
    ]);
  //TODO: Can we get the exported priority names here?
  initial.addResource('messages', '1')
    .withAttributes({
      text: "Matt, could you push live my cover of Pearl Jam's Daughter?",
      status: 'pending',
      priority: 'Need Response',
      tag: 'Request to publish live',
      isHandled: false,
      updatedAt: moment(),
    });
  initial.addResource('messages', '2')
    .withAttributes({
      text: "Needs to have the Home song approved by tomorrow.",
      status: 'approved', // CueCard prop
      priority: 'Need Response',
      tag: 'Request to publish live',
      isHandled: false,
      updatedAt: moment('2017-09-07')
    });
  initial.addResource('messages', '3')
    .withAttributes({
      text: "Tool's Forty Six & 2. Please approve.",
      status: 'denied',
      priority: 'Need Response',
      tag: 'Ready for copyediting',
      isHandled: false,
      updatedAt: moment()
    });
  initial.addResource('messages', '4')
    .withAttributes({
      text: 'Eddie Vedder\' public key checks out.',
      status: 'approved',
      priority: 'Automatically Processed',
      tag: 'Course information synced',
      isHandled: false,
      updatedAt: moment('2017-09-04')
    });
  initial.addResource('messages', '5')
    .withAttributes({
      text: 'Verified song identity for Seven Nations Army.',
      status: 'approved',
      priority: 'Automatically Processed',
      tag: 'Course information synced',
      isHandled: true,
      updatedAt: moment()
    });
  initial.addResource('messages', '6')
    .withAttributes({
      text: 'All is quiet.',
      status: 'approved',
      priority: 'For Your Information',
      tag: 'New local content added',
      isHandled: false,
      updatedAt: moment('2017-08-31')
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
