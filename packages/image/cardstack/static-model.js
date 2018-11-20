const Factory = require('@cardstack/test-support/jsonapi-factory');

module.exports = function({ storeImageMetadataIn }) {
  let factory = new Factory();

  factory.addResource('content-types', 'cardstack-images')
    .withAttributes({
      defaultIncludes: ['file']
    })
    .withRelated('fields', [
      factory.addResource('fields', 'alt-text').withAttributes({fieldType: '@cardstack/core-types::string'}),
      factory.addResource('fields', 'file')
        .withAttributes({
          'field-type': '@cardstack/core-types::belongs-to',
        })
        .withRelated('relatedTypes', [
          {type: 'content-types', id: 'cardstack-files'}
        ])
    ])
    .withRelated('data-source', storeImageMetadataIn);

  return factory.getModels();
};