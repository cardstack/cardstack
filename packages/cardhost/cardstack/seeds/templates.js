const Factory = require('@cardstack/test-support/jsonapi-factory');

let locationFactory = new Factory();
let locationCardTemplate = locationFactory.getDocumentFor(
  locationFactory
    .addResource('cards', 'local-hub::location-card')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      locationFactory.addResource('fields', 'address').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Street Address',
      }),
      locationFactory.addResource('fields', 'address2').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Apt #/Unit',
      }),
      locationFactory.addResource('fields', 'city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'City',
      }),
      locationFactory.addResource('fields', 'state').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'State',
      }),
      locationFactory.addResource('fields', 'zip').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Zip Code',
      }),
      locationFactory.addResource('fields', 'country').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        caption: 'Country',
      }),
    ])
    .withRelated(
      'model',
      locationFactory.addResource('local-hub::location-card', 'local-hub::location-card').withAttributes({
        address: '123 Main St.',
        city: 'Anytown',
        state: 'MA',
        zip: '12345',
        country: 'USA',
      })
    )
);

let eventFactory = new Factory();
let eventCardTemplate = eventFactory.getDocumentFor(
  eventFactory
    .addResource('cards', 'local-hub::event-card')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      eventFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: true,
        caption: 'Event name',
      }),
      eventFactory.addResource('fields', 'date').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        'needed-when-embedded': true,
        required: true,
        caption: 'Date & Time',
      }),
      eventFactory.addResource('fields', 'background-image').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
        'needed-when-embedded': false,
      }),
      eventFactory.addResource('fields', 'cta').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
        caption: 'CTA Text',
      }),
      eventFactory.addResource('fields', 'location').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
      }),
      eventFactory.addResource('fields', 'city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
      }),
      eventFactory.addResource('fields', 'admission').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
      }),
      eventFactory.addResource('fields', 'description').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
      }),
    ])
    .withRelated(
      'model',
      eventFactory.addResource('local-hub::event-card', 'local-hub::event-card').withAttributes({
        backgroundImage: 'https://images.unsplash.com/photo-1542296140-47fd7d838e76',
        title: 'Quarterly Planning Meeting',
        date: '2020-05-26',
        location: 'One World Trade Center',
        city: 'New York, NY',
        admission: 'Free',
        description:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.',
        cta: 'RSVP',
      })
    )
);

let jobCardTemplate = eventFactory.getDocumentFor(
  eventFactory
    .addResource('cards', 'local-hub::job-description')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      eventFactory.addResource('fields', 'company').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: true,
        caption: 'Company',
      }),
      eventFactory.addResource('fields', 'job-title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: true,
        caption: 'Job Title',
      }),
      eventFactory.addResource('fields', 'job-description').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
        caption: 'Job Description',
      }),
      eventFactory.addResource('fields', 'responsibilities').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
        caption: 'Responsibilities',
      }),
    ])
    .withRelated(
      'model',
      eventFactory.addResource('local-hub::job-description', 'local-hub::job-description').withAttributes({
        company: 'StackBox Creative LLC',
        jobTitle: 'Videographer',
        jobDescription:
          'Join our marketing team, as we open a new flagship store in New York City, and create compelling videos.',
        responsibilities:
          'Follow the marketing team to events, create camera footage for a B-roll film, produce a sales pitch for a client, conduct interviews.',
      })
    )
);

let jobApplicantProfileTemplate = eventFactory.getDocumentFor(
  eventFactory
    .addResource('cards', 'local-hub::job-applicant-profile')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      eventFactory.addResource('fields', 'name').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: true,
        caption: 'Name',
      }),
      eventFactory.addResource('fields', 'portfolio').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: true,
        caption: 'Link to your portfolio',
      }),
      eventFactory.addResource('fields', 'address').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        caption: 'Address',
      }),
      eventFactory.addResource('fields', 'phone-number').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: false,
        caption: 'Phone Number',
      }),
      eventFactory.addResource('fields', 'email').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: false,
        caption: 'Email',
      }),
      eventFactory.addResource('fields', 'date-start').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        required: false,
        caption: 'What is the earliest date you would be available to start?',
      }),
    ])
    .withRelated(
      'model',
      eventFactory.addResource('local-hub::job-applicant-profile', 'local-hub::job-applicant-profile').withAttributes({
        name: 'Marcel Bridges',
        portfolio: 'marcel-bridges.example.com/portfolio',
        address: 'Chicago, IL',
        phoneNumber: '555-555-5555',
        email: 'marcel_bridges@example.com',
        dateStart: '2020-02-01',
      })
    )
);

module.exports = [locationCardTemplate, eventCardTemplate, jobCardTemplate, jobApplicantProfileTemplate];
