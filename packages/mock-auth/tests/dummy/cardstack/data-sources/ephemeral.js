/* eslint-env node */

module.exports = [
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
  },
  {
    type: 'grants',
    id: '0',
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
        data: { type: 'fields', id: 'id' }
      }
    }
  }
];

