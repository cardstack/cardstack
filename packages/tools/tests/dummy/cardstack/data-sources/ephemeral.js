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
    type: 'data-sources',
    id: 'mock-auth',
    attributes: {
      'source-type': '@cardstack/mock-auth',
      params: {
        users: {
          user1: {
            name: 'Carl Stack',
            email: 'carlstack@cardstack.com',
            verified: true
          }
        }
      }
    }
  },
];
