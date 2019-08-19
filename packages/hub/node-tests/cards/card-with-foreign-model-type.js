const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::foreign-model-type-card::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-model-type-card::title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::article-card', 'local-hub::foreign-model-type-card::bad')
      .withAttributes({
        'title': "I don't belong to you"
      })
    )
);