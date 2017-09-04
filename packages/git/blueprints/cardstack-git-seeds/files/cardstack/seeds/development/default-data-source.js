/* eslint-env node */

module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'cardstack-git-default' }
      }
    }
  }
];
