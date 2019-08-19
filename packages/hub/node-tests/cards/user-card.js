const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
let factory = new JSONAPIFactory();

module.exports = factory.getDocumentFor(
  factory.addResource('cards', 'local-hub::user-card::van-gogh')
    .withAttributes({
      'isolated-template': `
        <div>{{this.name}}</div>
        <div>{{this.email}}</div>
      `,
      'embedded-template': `
        <div>{{this.name}}</div>
      `,
    })
    .withRelated('fields', [
      factory.addResource('fields', 'local-hub::user-card::name').withAttributes({
        'is-metadata': true,
        'needed-when-embedded': true,
        'field-type': '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'local-hub::user-card::email').withAttributes({
        'is-metadata': true,
        'field-type': '@cardstack/core-types::case-insensitive'
      }),
    ])
    .withRelated('model', factory.addResource('local-hub::user-card', 'local-hub::user-card::van-gogh')
      .withAttributes({
        name: 'Van Gogh',
        email: 'van-gogh@nowhere.dog'
      })
    )
);