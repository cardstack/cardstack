const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::mismatched-model-id-card::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::mismatched-model-id-card::title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::mismatched-model-id-card', 'local-hub::mismatched-model-id-card::who-are-you')
      .withAttributes({
        'title': "I don't know who I am"
      })
    )
);