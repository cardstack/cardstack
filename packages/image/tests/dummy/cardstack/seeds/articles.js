const Factory = require('@cardstack/test-support/jsonapi-factory');

let factory = new Factory();

factory.addResource('content-types', 'articles')
  .withAttributes({
    defaultIncludes: ['cover-image']
  })
  .withRelated('fields', [
    factory.addResource('fields', 'name').withAttributes({fieldType: '@cardstack/core-types::string'}),
    factory.addResource('fields', 'description').withAttributes({fieldType: '@cardstack/core-types::string'}),
    factory.addResource('fields', 'cover-image')
      .withAttributes({
        'field-type': '@cardstack/core-types::belongs-to',
      })
      .withRelated('relatedTypes', [
        {type: 'content-types', id: 'cardstack-images'}
      ])
  ]);


let grants = [

  {
    type: 'grants',
    id: 'wide-open',
    attributes: {
      'may-write-fields': true,
      'may-read-fields': true,
      'may-create-resource': true,
      'may-update-resource': true,
      'may-delete-resource': true,
      'may-read-resource': true
    },
    relationships: {
      who: {
        data: [{
          type: 'groups',
          id: 'everyone'
        }]
      }
    }
  }
];

module.exports = factory.getModels().concat(grants);
