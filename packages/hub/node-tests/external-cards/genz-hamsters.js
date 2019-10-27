const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::article-card::genz-hamsters')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::adopted-card::genx-kittens'})
    .withRelated('fields', [
      factory.addResource('fields', 'cuteness').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::integer',
      })
    ])
    .withRelated('model',
      factory.addResource('local-hub::article-card::genz-hamsters', 'local-hub::article-card::genz-hamsters')
        .withAttributes({
          yarn: 'cotton',
          cuteness: 10,
          title: 'GenZ Hamsters',
          body: 'I am a body'
        })
        .withRelated('author', { type: 'cards', id: 'local-hub::user-card::van-gogh' })
    )
);