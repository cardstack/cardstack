/* eslint-env node */

const { initialModels } = require('../test/ephemeral');


module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/ephemeral',
    attributes: {
      module: '@cardstack/ephemeral'
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
    attributes: {
      module: '@cardstack/hub'
    },
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'default' }
      }
    }
  }
];
