const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::foreign-schema-card::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::article-card::not-your-field').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::foreign-schema-card', 'local-hub::foreign-schema-card::bad')
      .withAttributes({
        'not-your-field': "I don't belong to you"
      })
    )
);