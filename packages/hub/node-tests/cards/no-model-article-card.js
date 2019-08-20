const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::article-card::empty-article')
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
      // Note that we're not explicitly specifying the card metadata. The card should be able
      // generate its metadata based on the fields that we have defined for the card and
      // the model data that we have specified for the card.
    })
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::article-card::title').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string' //TODO rework for fields-as-cards
      }).withRelated('constraints', [
        factory.addResource('constraints', 'local-hub::article-card::title-not-null')
          .withAttributes({
            'constraint-type': '@cardstack/core-types::not-null',
            'error-message': 'The title must not be empty.'
          })
      ]),
      factory.addResource('fields', 'local-hub::article-card::author').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::belongs-to'
      }), // TODO add the idea of "related-cards" after we support adopts and implements
      factory.addResource('fields', 'local-hub::article-card::body').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'local-hub::article-card::internal-field').withAttributes({
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('computed-fields', 'local-hub::article-card::tag-names').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'computed-field-type': 'stub-card-project::tags'
      }),

      // TODO is this a legit scenario where a card has a metadata relationship field
      // to an internal model? Maybe instead, cards' metadata relationships can only be to other cards?
      factory.addResource('fields', 'local-hub::article-card::tags').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::has-many'
      }).withRelated('related-types', [
        // this is modeling an enumeration using a private model.
        // this content type name will be prefixed with the card's
        // package and card name, such that other cards can also
        // have their own 'tags' internal content types.
        factory.addResource('content-types', 'local-hub::article-card::tags')
      ]),
    ])
);
