const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::genz-hamsters')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::genx-kittens'})
    .withRelated('fields', [
      factory.addResource('fields', 'cuteness').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::integer',
      })
    ])
    .withRelated('model',
      factory.addResource('local-hub::genz-hamsters', 'local-hub::genz-hamsters')
        .withAttributes({
          yarn: 'cotton',
          cuteness: 10,
          title: 'GenZ Hamsters',
          body: 'I am a body'
        })
        .withRelated('author', { type: 'cards', id: 'local-hub::van-gogh' })
    )
);