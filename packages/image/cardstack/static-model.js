const Factory = require('@cardstack/test-support/jsonapi-factory');

module.exports = function({ storeImageMetadataIn }) {
  let factory = new Factory();

  factory.addResource('content-types', 'cardstack-images')
    .withAttributes({
      defaultIncludes: ['file']
    })
    .withRelated('fields', [
      factory.addResource('fields', 'alt-text').withAttributes({fieldType: '@cardstack/core-types::string'}),
      factory.addResource('computed-fields', 'image-file-name').withAttributes({
        editorOptions: { hideFromEditor: true },
        'computed-field-type': '@cardstack/core-types::alias',
        params: {
          'aliasPath': 'file.file-name',
        }
      }),
      factory.addResource('computed-fields', 'image-created-at').withAttributes({
        editorOptions: { hideFromEditor: true },
        'computed-field-type': '@cardstack/core-types::alias',
        params: {
          'aliasPath': 'file.created-at',
        }
      }),
      factory.addResource('computed-fields', 'image-size').withAttributes({
        editorOptions: { hideFromEditor: true },
        'computed-field-type': '@cardstack/core-types::alias',
        params: {
          'aliasPath': 'file.size',
        }
      }),
      factory.addResource('computed-fields', 'image-content-type').withAttributes({
        editorOptions: { hideFromEditor: true },
        'computed-field-type': '@cardstack/core-types::alias',
        params: {
          'aliasPath': 'file.content-type',
        }
      }),
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