
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

let card = factory.getDocumentFor(
  factory.addResource('local-hub::foreign-internal-has-many-relationship', 'local-hub::foreign-internal-has-many-relationship')
    .withRelated('local-hub::foreign-internal-has-many-relationship::related-things', [
      { type: 'local-hub::millenial-puppies::internal', id: 'local-hub::millenial-puppies::internal-item' }
    ])
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-internal-has-many-relationship::related-things').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }),
    ])
);

module.exports = card;