const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

// This is the internal representation of a card. Browser clients do not
// encounter this form of a card. Look at the jsonapi tests and browser
// tests for the structure of a card as it is known externally.
let card = factory.getDocumentFor(
  factory
    .addResource('local-hub::van-gogh', 'local-hub::van-gogh')
    .withAttributes({
      'local-hub::van-gogh::name': 'Van Gogh',
      'local-hub::van-gogh::email': 'van-gogh@nowhere.dog',
    })
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::van-gogh::name').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'local-hub::van-gogh::email').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
      }),
    ])
);

module.exports = card;
