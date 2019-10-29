const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::hassan')
    .withRelated('fields', [
      factory.addResource('fields', 'name').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      factory.addResource('fields', 'email').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::hassan', 'local-hub::hassan')
      .withAttributes({
        name: "Hassan",
        email: "hassan@nowhere.dog",
      })
    )
);