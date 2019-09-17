const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('local-hub::foreign-schema-card::bad', 'local-hub::foreign-schema-card::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::article-card::bad::not-your-field').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
    ])
);