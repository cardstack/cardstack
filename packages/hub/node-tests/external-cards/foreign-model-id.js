const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::foreign-model-id-card::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-model-id-card::bad::title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::foreign-model-id-card::bad', 'local-hub::foreign-model-id-card::ugh')
      .withAttributes({
        'title': "I don't belong to you"
      })
    )
);