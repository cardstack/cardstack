const Factory = require('@cardstack/test-support/jsonapi-factory');

let locationFactory = new Factory();
let locationCardTemplate = locationFactory.getDocumentFor(
  locationFactory.addResource('cards', 'local-hub::location-card')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      locationFactory.addResource('fields', 'address').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Street Address'
      }),
      locationFactory.addResource('fields', 'address2').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Apt #/Unit'
      }),
      locationFactory.addResource('fields', 'city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'City'
      }),
      locationFactory.addResource('fields', 'state').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'State'
      }),
      locationFactory.addResource('fields', 'zip').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Zip Code'
      }),
      locationFactory.addResource('fields', 'country').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Country'
      }),
    ])
    .withRelated('model', locationFactory.addResource('local-hub::location-card', 'local-hub::location-card')
      .withAttributes({
        address: "123 Main St.",
        city: "Anytown",
        state: "MA",
        zip: "12345",
        country: "USA"
      })
    )
);

let eventFactory = new Factory();
let eventCardTemplate = eventFactory.getDocumentFor(
  eventFactory.addResource('cards', 'local-hub::event-card')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      eventFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Event name'
      }),
      eventFactory.addResource('fields', 'date').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        'needed-when-embedded': true,
        caption: 'Date & Time'
      }),
      eventFactory.addResource('fields', 'image').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true
      }),
      eventFactory.addResource('fields', 'cta').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        caption: 'CTA Text'
      }),
      eventFactory.addResource('fields', 'location').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      eventFactory.addResource('fields', 'city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      eventFactory.addResource('fields', 'admission').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
      eventFactory.addResource('fields', 'description').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
      }),
    ])
    .withRelated('model', eventFactory.addResource('local-hub::event-card', 'local-hub::event-card')
      .withAttributes({
        image: "https://images.unsplash.com/photo-1542296140-47fd7d838e76",
        title: "Ember Meetup NYC",
        date: "2019-09-26",
        location: "One World Trade Center",
        city: "New York, NY",
        admission: 'Free',
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.",
        cta: 'RSVP'
      })
    )
);

module.exports = [ locationCardTemplate, eventCardTemplate ];
