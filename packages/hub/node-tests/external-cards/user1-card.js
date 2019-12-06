const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory
    .addResource('cards', 'local-hub::van-gogh')
    .withRelated('fields', [
      factory.addResource('fields', 'name').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'email').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
      }),
      factory.addResource('fields', 'friends').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::has-many',
      }),
    ])
    .withRelated(
      'model',
      factory
        .addResource('local-hub::van-gogh', 'local-hub::van-gogh')
        .withAttributes({
          name: 'Van Gogh',
          email: 'vangogh@nowhere.dog',
        })
        .withRelated('friends', [{ type: 'cards', id: 'local-hub::hassan' }])
    )
);
