
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

let card = factory.getDocumentFor(
  factory.addResource('local-hub::foreign-included::bad', 'local-hub::foreign-included::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-included::bad::tags').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }).withRelated('related-types', [
        factory.addResource('content-types', 'local-hub::foreign-included::millenial-puppies::tags')
      ]),
    ])
);

module.exports = card;