const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::adopted-card::genx-kittens')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::article-card::millenial-puppies'})
    .withRelated('fields', [
      factory.addResource('fields', 'yarn').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string',
      })
    ])
    .withRelated('model',
      factory.addResource('local-hub::adopted-card::genx-kittens', 'local-hub::adopted-card::genx-kittens')
        .withAttributes({
          yarn: 'wool',
          title: 'GenX Kittens',
          body: 'Here is the body'
        })
        .withRelated('author', { type: 'cards', id: 'local-hub::user-card::van-gogh' })
    )
);