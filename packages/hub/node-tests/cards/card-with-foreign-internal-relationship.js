const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::foreign-internal-relationship::bad')
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::foreign-internal-relationship::related-thing').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::belongs-to'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::foreign-internal-relationship', 'local-hub::foreign-internal-relationship::bad')
      .withRelated('related-thing', { type: 'local-hub::foreign-internal-relationship', id: 'local-hub::foreign-internal-relationship::millenial-puppies' })
    )
);