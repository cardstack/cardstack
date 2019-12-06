const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(factory.addResource('local-hub::article-card', 'local-hub::mismatched-model'));
