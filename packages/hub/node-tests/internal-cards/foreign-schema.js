const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('local-hub::foreign-schema-card', 'local-hub::foreign-schema-card').withRelated('fields', [
    factory.addResource('fields', 'local-hub::article-card::not-your-field').withAttributes({
      'is-metadata': true,
      'field-type': '@cardstack/core-types::string',
    }),
  ])
);
