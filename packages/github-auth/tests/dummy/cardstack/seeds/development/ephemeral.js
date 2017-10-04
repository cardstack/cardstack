/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

module.exports = [
  {
    type: 'plugin-configs',
    id: '@cardstack/ephemeral'
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
  factory.addResource('data-sources', 'github')
    .withAttributes({
      sourceType: '@cardstack/github-auth',
      params: {
        'client-id': process.env.GITHUB_CLIENT_ID,
        'client-secret': process.env.GITHUB_CLIENT_SECRET,
        token: process.env.GITHUB_TOKEN
      }
    })
  return factory.getModels()
}
