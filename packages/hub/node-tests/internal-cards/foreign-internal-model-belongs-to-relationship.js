const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

let card = factory.getDocumentFor(
  factory
    .addResource(
      'local-hub::foreign-internal-belongs-to-relationship',
      'local-hub::foreign-internal-belongs-to-relationship'
    )
    .withRelated('local-hub::foreign-internal-belongs-to-relationship::related-thing', {
      type: 'local-hub::millenial-puppies::internal',
      id: 'local-hub::millenial-puppies::internal-item',
    })
    .withRelated('fields', [
      factory
        .addResource('fields', 'local-hub::foreign-internal-belongs-to-relationship::related-thing')
        .withAttributes({
          'is-metadata': true,
          'field-type': '@cardstack/core-types::belongs-to',
        }),
    ])
);

module.exports = card;
