/* eslint-env node */

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
    }
  },
  {
    type: 'grants',
    id: 0,
    attributes: {
      'may-create-resource': true,
      'may-read-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true,
      'may-read-fields': true,
      'may-write-fields': true
    },
    relationships: {
      who: {
        data: [{ type: 'groups', id: 'everyone' }]
      }
    }
  }
];
