/* eslint-env node */
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

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
    });
  return factory.getModels();
}

module.exports = initialModels();
