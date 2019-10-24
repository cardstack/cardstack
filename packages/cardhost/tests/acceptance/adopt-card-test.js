// test that fields are not overridable
// Cards should be able to adopt in a graph - no override of fields


const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();


// Setup this as an existing card in the hub
module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::article::template')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      factory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      })
    ])
    .withRelated('model', factory.addResource('local-hub::article::template', 'local-hub::article::template')
      .withAttributes({
        title: "Lorem ipsum dolor sit amet",
        body: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Saepe rerum ipsum, eaque eveniet, delectus doloribus nesciunt. Libero vero ratione nisi, eveniet placeat ut, cupiditate, possimus perferendis maxime earum minima quia.",
      })
    )
);

// 2. go to /cards/adopt, have some ui to basically submit this:

// new method on data service adopt-card or just create with field

factory.addResource('cards', 'local-hub::alexs-blog::first-post')
  .withRelated('adopted-card', 'local-hub::article::template')
  .withRelated('model', factory.addResource('local-hub::alexs-blog::first-post', 'local-hub::alexs-blog::first-post')
    .withAttributes({
      title: "My first post",
      body: "Here is the first post",
    })
  )


// 3. should get something back from /should be stored in the hub:

  factory.addResource('cards', 'local-hub::alexs-blog::first-post')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      factory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      })
    ])
    .withRelated('model', factory.addResource('local-hub::article::template', 'local-hub::article::template')
      .withAttributes({
        title: "Lorem ipsum dolor sit amet",
        body: "Lorem ipsum dolor sit amet, consectetur adipisicing elit. Saepe rerum ipsum, eaque eveniet, delectus doloribus nesciunt. Libero vero ratione nisi, eveniet placeat ut, cupiditate, possimus perferendis maxime earum minima quia.",
      })
    )

// 2. go to /cards/adopt, have some ui to basically submit this:

// new method on data service adopt-card or just create with field

// 3. fields should be included




// Other test:
// Adopted fields should be hoisted into card resource when they have data


// metadata is data about the card that is exposed externally. Basically means 'public'