const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::why-doors')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      factory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'author').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::belongs-to',
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::why-doors', 'local-hub::why-doors')
      .withAttributes({
        title: "Why Doors?",
        body: "What is the deal with doors, and how come there are so many of them?",
      })
      .withRelated('author', { type: 'cards', id: 'local-hub::van-gogh' })
    )
);