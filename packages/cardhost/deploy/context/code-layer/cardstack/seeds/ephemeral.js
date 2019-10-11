const Factory = require('@cardstack/test-support/jsonapi-factory');

let factory = new Factory();
factory.addResource('grants', 'world-read')
  .withAttributes({
    mayReadFields: true,
    mayReadResource: true,
  })
  .withRelated('who', [{ type: 'groups', id: 'everyone' }]);

// TODO this is for testing only--eventually we should
// only use mock-auth in the development and test environments
factory.addResource('grants', 'mock-user-access')
  .withAttributes({
    mayWriteFields: true,
    mayReadFields: true,
    mayCreateResource: true,
    mayReadResource: true,
    mayUpdateResource: true,
    mayDeleteResource: true,
    mayLogin: true
  })
  .withRelated('who', [{ type: 'mock-users', id: 'user1' }]);

let articleFactory = new Factory();
let articleCard = articleFactory.getDocumentFor(
  articleFactory.addResource('cards', 'local-hub::article-card::why-doors')
    .withRelated('fields', [
      articleFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      articleFactory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      articleFactory.addResource('fields', 'author').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::belongs-to',
        'needed-when-embedded': true
      }),
    ])
    .withRelated('model', articleFactory.addResource('local-hub::article-card::why-doors', 'local-hub::article-card::why-doors')
      .withAttributes({
        title: "Why Doors?",
        body: "What is the deal with doors, and how come there are so many of them?",
      })
      .withRelated('author', { type: 'cards', id: 'local-hub::user-card::ringo' })
    )
);

let userFactory = new Factory();
let userCard = userFactory.getDocumentFor(
  userFactory.addResource('cards', 'local-hub::user-card::ringo')
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
    .withRelated('model', userFactory.addResource('local-hub::user-card::ringo', 'local-hub::user-card::ringo')
      .withAttributes({
        name: "Ringo",
        email: "ringo@nowhere.dog",
      })
    )
);

module.exports = factory.getModels().concat([articleCard, userCard]);
