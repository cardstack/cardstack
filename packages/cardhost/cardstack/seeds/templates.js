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
      eventFactory.addResource('fields', 'divider').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::boolean',
        'needed-when-embedded': true,
      }),
      eventFactory.addResource('fields', 'background-image').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::decorative-image',
        'needed-when-embedded': true,
        required: false,
        caption: 'Background image',
      }),
      eventFactory.addResource('fields', 'event-date').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        'needed-when-embedded': true,
        required: false,
        caption: 'Date',
      }),
      eventFactory.addResource('fields', 'event-location').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: false,
        caption: 'Location',
      }),
      eventFactory.addResource('fields', 'event-city').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: false,
        caption: 'City',
      }),
      eventFactory.addResource('fields', 'event-admission').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: false,
        caption: 'Admission',
      }),
      eventFactory.addResource('fields', 'event-cta').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::cta',
        'needed-when-embedded': true,
        required: false,
        caption: 'RSVP',
      }),
      eventFactory.addResource('fields', 'body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        required: false,
        caption: 'Description',
      }),
    ])
    .withRelated(
      'model',
      eventFactory.addResource('local-hub::event-card', 'local-hub::event-card').withAttributes({
        title: 'Quarterly Planning Meeting',
        backgroundImage: 'https://images.unsplash.com/photo-1542296140-47fd7d838e76',
        divider: true,
        eventDate: '2020-05-26',
        eventLocation: 'One World Trade Center',
        eventCity: 'New York, NY',
        eventAdmission: 'Free',
        body:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.',
        eventCta: '',
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

let eventTicketTemplate = eventFactory.getDocumentFor(
  eventFactory
    .addResource('cards', 'local-hub::event-ticket')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      eventFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        'needed-when-embedded': true,
        required: true,
        caption: 'Title',
      }),
      eventFactory.addResource('fields', 'highlight-title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        'needed-when-embedded': true,
        required: false,
        caption: 'Highlight title',
      }),
      eventFactory.addResource('fields', 'divider').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::boolean',
        'needed-when-embedded': true,
        caption: 'Divider',
      }),
      eventFactory.addResource('fields', 'guest-name').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'Guest name',
      }),
      eventFactory.addResource('fields', 'number-of-tickets').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::integer',
        required: true,
        'needed-when-embedded': true,
        caption: 'Number of tickets',
      }),
      eventFactory.addResource('fields', 'date').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        required: true,
        'needed-when-embedded': true,
        caption: 'Date',
      }),
      eventFactory.addResource('fields', 'wheelchair-access').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::boolean',
        required: true,
        'needed-when-embedded': true,
        caption: 'Wheelchair access',
      }),
      eventFactory.addResource('fields', 'section').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'Section',
      }),
      eventFactory.addResource('fields', 'features').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'VIP package',
      }),
      eventFactory.addResource('fields', 'qr-code').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::decorative-image',
        required: true,
        'needed-when-embedded': true,
        caption: 'QR code',
      }),
    ])
    .withRelated(
      'model',
      eventFactory.addResource('local-hub::event-ticket', 'local-hub::event-ticket').withAttributes({
        title: 'Never Empty Cup Launch Party',
        highlightTitle: 'VIP Guest Ticket',
        divider: true,
        guestName: 'Charlie Peel',
        numberOfTickets: 4,
        date: '2020-02-27',
        wheelchairAccess: false,
        section: 'Main floor',
        features: 'Backstage pass, Open bar, VIP parking',
        qrCode:
          'https://www.qr-code-generator.com/wp-content/themes/qr/new_structure/markets/core_market_full/generator/dist/generator/assets/images/websiteQRCode_noFrame.png',
      })
    )
);

let productFactory = new Factory();
let productCardTemplate = productFactory.getDocumentFor(
  productFactory
    .addResource('cards', 'local-hub::product-card')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      productFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: true,
        caption: 'Title',
      }),
      productFactory.addResource('fields', 'title-logo').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::decorative-image',
        'needed-when-embedded': true,
        required: false,
        caption: 'Title logo',
      }),
      productFactory.addResource('fields', 'highlight-title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        'needed-when-embedded': true,
        required: false,
        caption: 'Highlight Title',
      }),
      productFactory.addResource('fields', 'divider').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::boolean',
        'needed-when-embedded': true,
        caption: 'Divider',
      }),
      productFactory.addResource('fields', 'product-ranking').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::integer',
        'needed-when-embedded': true,
        required: true,
        caption: 'Score',
      }),
      productFactory.addResource('fields', 'product-rating').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::integer',
        'needed-when-embedded': true,
        required: true,
        caption: 'Rating (Out of 100, in increments of 10)',
      }),
      productFactory.addResource('fields', 'product-company').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: false,
        caption: 'Company',
      }),
      productFactory.addResource('fields', 'product-company-logo').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::decorative-image',
        'needed-when-embedded': true,
        required: false,
        caption: 'Logo',
      }),
      productFactory.addResource('fields', 'product-name').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string',
        'needed-when-embedded': true,
        required: false,
        caption: 'Product name',
      }),
      productFactory.addResource('fields', 'product-image').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::decorative-image',
        'needed-when-embedded': true,
        required: false,
        caption: 'Product image',
      }),
      productFactory.addResource('fields', 'product-description').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        'needed-when-embedded': false,
        required: false,
        caption: 'Description',
      }),
      productFactory.addResource('fields', 'product-link').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::link',
        'needed-when-embedded': true,
        required: true,
        caption: 'View Details',
      }),
      productFactory.addResource('fields', 'product-cta').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::cta',
        'needed-when-embedded': true,
        required: true,
        caption: 'Buy Now',
      }),
    ])
    .withRelated(
      'model',
      productFactory.addResource('local-hub::product-card', 'local-hub::product-card').withAttributes({
        title: 'Coffee Bean Award 2020 Winners',
        titleLogo: '/assets/images/cards/coffee-bean/coffee-competition-logo.svg',
        highlightTitle: '2nd Place',
        divider: true,
        productRanking: 2,
        productRating: 90,
        productCompany: 'Ultra Strong Coffee',
        productCompanyLogo: '/assets/images/cards/coffee-bean/coffee-logo.svg',
        productName: 'Kenian Devil Roast',
        productImage: '/assets/images/cards/coffee-bean/coffee-image.svg',
        productDescription:
          'Pleasant aroma, deep acidity, and a unique bergamot flavor – this is a coffee that won’t let you sleep. It is grown in the volcanic soils around Mt. Kenya.',
        productLink: '',
        productCta: '',
      })
    )
);

let weddingFactory = new Factory();
let weddingInvitationTemplate = weddingFactory.getDocumentFor(
  weddingFactory
    .addResource('cards', 'local-hub::wedding-invitation')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::@cardstack/base-card' })
    .withRelated('fields', [
      weddingFactory.addResource('fields', 'title').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        'needed-when-embedded': true,
        required: true,
        caption: 'Title',
      }),
      weddingFactory.addResource('fields', 'divider').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::boolean',
        'needed-when-embedded': true,
        caption: 'Divider',
      }),
      weddingFactory.addResource('fields', 'wedding-name').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'Name',
      }),
      weddingFactory.addResource('fields', 'wedding-name-partner').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'Name',
      }),
      weddingFactory.addResource('fields', 'wedding-date').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        required: true,
        'needed-when-embedded': true,
        caption: 'Wedding date',
      }),
      weddingFactory.addResource('fields', 'wedding-time').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'Wedding time',
      }),
      weddingFactory.addResource('fields', 'wedding-reception-address').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: true,
        'needed-when-embedded': true,
        caption: 'Reception address',
      }),
      weddingFactory.addResource('fields', 'wedding-intro-text').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive',
        required: false,
        'needed-when-embedded': true,
        caption: 'Intro text',
      }),
      weddingFactory.addResource('fields', 'wedding-rsvp-date').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::date',
        required: true,
        'needed-when-embedded': true,
        caption: 'RSVP by',
      }),
      weddingFactory.addResource('fields', 'wedding-website').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::link',
        required: false,
        'needed-when-embedded': true,
        caption: 'Learn more on our Website',
      }),
      weddingFactory.addResource('fields', 'wedding-rsvp-cta').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::cta',
        required: true,
        'needed-when-embedded': true,
        caption: 'RSVP',
      }),
    ])
    .withRelated(
      'model',
      weddingFactory.addResource('local-hub::wedding-invitation', 'local-hub::wedding-invitation').withAttributes({
        title: 'Wedding Invitation',
        divider: true,
        weddingName: 'Willa Karciana',
        weddingNamePartner: 'Rufus Jackson',
        weddingDate: '2021-06-05',
        weddingTime: '3 PM',
        weddingReceptionAddress: 'The Gorgeous Hotel, 96 Hilton Avenue, San Francisco, CA',
        weddingRsvpDate: '2021-05-01',
        weddingWebsite: 'https://www.rufusandwillainwonderland.com',
        weddingRsvpCta: '',
        weddingIntroText: 'Please join us for the wedding of',
      })
    )
);

module.exports = [
  locationCardTemplate,
  eventCardTemplate,
  jobCardTemplate,
  jobApplicantProfileTemplate,
  eventTicketTemplate,
  productCardTemplate,
  weddingInvitationTemplate,
];
