const Factory = require('@cardstack/test-support/jsonapi-factory');

let articleFactory = new Factory();
let articleCard = articleFactory.getDocumentFor(
  articleFactory.addResource('cards', 'local-hub::why-doors')
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
    .withRelated('model', articleFactory.addResource('local-hub::why-doors', 'local-hub::why-doors')
      .withAttributes({
        title: "Why Doors?",
        body: "What is the deal with doors, and how come there are so many of them?",
      })
      .withRelated('author', { type: 'cards', id: 'local-hub::ringo' })
    )
);

let userFactory = new Factory();
let userCard = userFactory.getDocumentFor(
  userFactory.addResource('cards', 'local-hub::ringo')
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
    .withRelated('model', userFactory.addResource('local-hub::ringo', 'local-hub::ringo')
      .withAttributes({
        name: "Ringo",
        email: "ringo@nowhere.dog",
      })
    )
);

let eventFactory = new Factory();
let eventCard = eventFactory.getDocumentFor(
  eventFactory.addResource('cards', 'local-hub::event')
    .withRelated('fields', [
      eventFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      eventFactory.addResource('fields', 'image').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      eventFactory.addResource('fields', 'datetime').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        'needed-when-embedded': true
      }),
      eventFactory.addResource('fields', 'city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      eventFactory.addResource('fields', 'address').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      eventFactory.addResource('fields', 'price').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      eventFactory.addResource('fields', 'description').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
    ])
    .withRelated('model', eventFactory.addResource('local-hub::event', 'local-hub::event')
      .withAttributes({
        title: "Ember Meetup NYC",
        image: "/assets/images/cards/nyc.png",
        datetime: "2019-09-26",
        city: "New York, NY",
        address: "One World Trade Center",
        price: 'Free Admission',
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero."
      })
    )
);

module.exports = [articleCard, userCard, eventCard];
