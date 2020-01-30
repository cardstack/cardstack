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

let bylineFactory = new Factory();
let bylineCard = bylineFactory.getDocumentFor(
  bylineFactory
    .addResource('cards', 'local-hub::carlos')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::byline-card' })
    .withRelated(
      'model',
      bylineFactory.addResource('local-hub::carlos', 'local-hub::carlos').withAttributes({
        bylineName: 'Carlos Naipes',
        bylineImage: '/assets/images/cards/photo-skiing/photo-skiing-byline.png',
      })
    )
);

let photoFactory = new Factory();
let photoCard = photoFactory.getDocumentFor(
  photoFactory
    .addResource('cards', 'local-hub::photo-card-template')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::photo-card' })
    .withRelated(
      'model',
      photoFactory
        .addResource('local-hub::photo-card-template', 'local-hub::photo-card-template')
        .withAttributes({
          photoImageUrl: '/assets/images/cards/photo-skiing/photo-skiing.png',
          photoCaption: 'Hit the slopes as early as possible for the best snowboarding experience',
          photoDescription: 'Snowboarder riding down a groomed trail on a sunny day',
          photoKeywords: 'snow, snowboarder, sports, snowsports, wintersports, mountain, powder, blue, white',
          photoDatetime: '2020-01-25',
          photoLocation: 'Nassfeld, Austria',
        })
        .withRelated('photo-byline', { type: 'cards', id: 'local-hub::carlos' })
    )
);

let weddingFactory = new Factory();
let weddingInvitationCard = weddingFactory.getDocumentFor(
  weddingFactory
    .addResource('cards', 'local-hub::wedding-invitation-template')
    .withRelated('adopted-from', { type: 'cards', id: 'local-hub::wedding-invitation' })
    .withRelated(
      'model',
      weddingFactory
        .addResource('local-hub::wedding-invitation-template', 'local-hub::wedding-invitation-template')
        .withAttributes({
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

module.exports = [articleCard, userCard, bylineCard, photoCard, weddingInvitationCard];
