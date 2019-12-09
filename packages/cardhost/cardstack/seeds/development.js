const Factory = require('@cardstack/test-support/jsonapi-factory');

let articleFactory = new Factory();
let articleCard = articleFactory.getDocumentFor(
  articleFactory
    .addResource('cards', 'local-hub::why-doors')
    .withRelated('fields', [
      articleFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
      }),
      articleFactory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      articleFactory.addResource('fields', 'author').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::belongs-to',
        'needed-when-embedded': true,
      }),
    ])
    .withRelated(
      'model',
      articleFactory
        .addResource('local-hub::why-doors', 'local-hub::why-doors')
        .withAttributes({
          title: 'Why Doors?',
          body: 'What is the deal with doors, and how come there are so many of them?',
        })
        .withRelated('author', { type: 'cards', id: 'local-hub::ringo' })
    )
);

let userFactory = new Factory();
let userCard = userFactory.getDocumentFor(
  userFactory
    .addResource('cards', 'local-hub::ringo')
    .withRelated('fields', [
      userFactory.addResource('fields', 'name').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string',
      }),
      userFactory.addResource('fields', 'email').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
      }),
    ])
    .withRelated(
      'model',
      userFactory.addResource('local-hub::ringo', 'local-hub::ringo').withAttributes({
        name: 'Ringo',
        email: 'ringo@nowhere.dog',
      })
    )
);

module.exports = [articleCard, userCard];
