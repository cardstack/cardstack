/* eslint-env node */

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

function initialModels() {
  let initial = new JSONAPIFactory();

  initial.addResource('content-types', 'posts')
    .withRelated('fields', [
      initial.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      initial.addResource('fields', 'published-at').withAttributes({
        caption: 'Publish Date',
        fieldType: '@cardstack/core-types::date'
      }),
      initial.addResource('fields', 'reading-time-value').withAttributes({
        caption: 'Value',
        fieldType: '@cardstack/core-types::integer'
      }),
      initial.addResource('fields', 'reading-time-units').withAttributes({
        caption: 'Units',
        fieldType: '@cardstack/core-types::string'
      }),
    ]);
  initial.addResource('posts', '1')
    .withAttributes({
      title: 'hello world',
      publishedAt: new Date(2017, 3, 24),
      readingTimeValue: 8,
      readingTimeUnits: 'minutes',
    });
  initial.addResource('posts', '2')
    .withAttributes({
      title: 'second',
      publishedAt: new Date(2017, 9, 20),
      readingTimeValue: 2,
      readingTimeUnits: 'hours',
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
      'may-write-fields': true,
      'may-read-fields': true
    }
  }
];
