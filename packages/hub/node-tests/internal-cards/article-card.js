const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

// This is the internal representation of a card. Browser clients do not
// encounter this form of a card. Look at the jsonapi tests and browser
// tests for the structure of a card as it is known externally.
let card = factory.getDocumentFor(
  factory.addResource('local-hub::article-card::millenial-puppies', 'local-hub::article-card::millenial-puppies')
    .withAttributes({
      'isolated-template': `
        <h1>{{this.title}}</h1>
        <h3>By {{this.author}}</h3>
        <ul>
          {{#each this.tags as |tag|}}
            <li>{{tag.id}}</li>
          {{/each}}
        </ul>
        <div>{{this.body}}</div>
      `,
      'isolated-js': `
        import Component from '@glimmer/component';
        export default class ArticleIsolatedComponent extends Component {};
      `,
      'isolated-css': `
        .article-card-isolated {}
      `,
      'embedded-template': `
        <h3>{{this.title}}</h3>
        <p>By {{this.author}}</p>
      `,
      'embedded-js': `
        import Component from '@glimmer/component';
        export default class ArticleEmbeddedComponent extends Component {};
      `,
      'embedded-css': `
        .article-card-embedded {}
      `,
      'local-hub::article-card::millenial-puppies::internal-field': 'this is internal data',
      'local-hub::article-card::millenial-puppies::title': 'The Millenial Puppy',
      'local-hub::article-card::millenial-puppies::body': `
        It can be difficult these days to deal with the
        discerning tastes of the millenial puppy. In this
        article we probe the needs and desires of millenial
        puppies and why they love belly rubs so much.
      `
    })
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::article-card::millenial-puppies::title').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string' //TODO rework for fields-as-cards
      }).withRelated('constraints', [
        factory.addResource('constraints', 'local-hub::article-card::millenial-puppies::title-not-null')
          .withAttributes({
            'constraint-type': '@cardstack/core-types::not-null',
            'error-message': 'The title must not be empty.'
          })
      ]),
      // TODO add the idea of "related-cards" after we support adopts and implements
      factory.addResource('fields', 'local-hub::article-card::millenial-puppies::author').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::belongs-to'
      }),
      factory.addResource('fields', 'local-hub::article-card::millenial-puppies::body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'local-hub::article-card::millenial-puppies::internal-field').withAttributes({
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('computed-fields', 'local-hub::article-card::millenial-puppies::tag-names').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'computed-field-type': 'stub-card-project::tags'
      }),

      // TODO is this a legit scenario where a card has a metadata relationship field
      // to an internal model? Maybe instead, cards' metadata relationships can only be to other cards?
      // Maybe a better test involving relationships to internal models would be to consume
      // this relationship in a computed that is a metadata field (and probably we
      // should have a test that involves a card that has a relationship to another card).
      factory.addResource('fields', 'local-hub::article-card::millenial-puppies::tags').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }).withRelated('related-types', [
        // this is modeling an enumeration using a private model.
        // this content type name will be prefixed with the card's
        // package and card name, such that other cards can also
        // have their own 'tags' internal content types.
        factory.addResource('content-types', 'local-hub::article-card::millenial-puppies::tags')
      ]),
    ])
    .withRelated('local-hub::article-card::millenial-puppies::tags', [
      // Note that the tags models will be prefixed with this card's ID
      // such that you will never run into model collisions for tags
      // of different article cards
      factory.addResource('local-hub::article-card::millenial-puppies::tags', 'local-hub::article-card::millenial-puppies::millenials'),
      factory.addResource('local-hub::article-card::millenial-puppies::tags', 'local-hub::article-card::millenial-puppies::puppies'),
      factory.addResource('local-hub::article-card::millenial-puppies::tags', 'local-hub::article-card::millenial-puppies::belly-rubs'),
    ])
    .withRelated('local-hub::article-card::millenial-puppies::author',
      { type: 'local-hub::user-card::van-gogh', id: 'local-hub::user-card::van-gogh'}
    )
);

module.exports = card;