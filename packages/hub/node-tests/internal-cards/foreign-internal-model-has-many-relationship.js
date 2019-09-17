
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

let card = factory.getDocumentFor(
  factory.addResource('local-hub::foreign-internal-has-many-relationship::bad', 'local-hub::foreign-internal-has-many-relationship::bad')
    .withRelated('local-hub::foreign-internal-has-many-relationship::bad::related-things', [
      { type: 'local-hub::foreign-internal-has-many-relationship::bad', id: 'local-hub::foreign-internal-has-many-relationship::millenial-puppies::owner' }
    ])
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-internal-has-many-relationship::bad::related-things').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }),
    ])
);

module.exports = card;