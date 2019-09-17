
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

let card = factory.getDocumentFor(
  factory.addResource('local-hub::foreign-internal-belongs-to-relationship::bad', 'local-hub::foreign-internal-belongs-to-relationship::bad')
    .withRelated('local-hub::foreign-internal-belongs-to-relationship::bad::related-thing',
      { type: 'local-hub::foreign-internal-belongs-to-relationship::bad', id: 'local-hub::foreign-internal-belongs-to-relationship::millenial-puppies::owner' }
    )
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-internal-belongs-to-relationship::bad::related-thing').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::belongs-to'
      }),
    ])
);

module.exports = card;