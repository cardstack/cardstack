/* eslint-env node */

module.exports = [
  {
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/ephemeral'
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
    type: 'data-sources',
    id: '@cardstack/files',
    attributes: {
      'source-type': '@cardstack/files',
      params: {
        storeFilesIn: { type: 'data-sources', id: 'default' }
      }
    }
  },
  {
    type: 'data-sources',
    id: '@cardstack/image',
    attributes: {
      'source-type': '@cardstack/image',
      params: {
        storeImageMetadataIn: { type: 'data-sources', id: 'default' }
      }
    }
  }
];
