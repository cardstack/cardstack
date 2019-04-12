const Factory = require('@cardstack/test-support/jsonapi-factory');


module.exports = function({ storeFilesIn }) {
  let factory = new Factory();

  factory.addResource('content-types', 'cardstack-files')
    .withRelated('fields', [
      factory.addResource('fields', 'created-at').withAttributes({fieldType: '@cardstack/core-types::date'}),
      factory.addResource('fields', 'content-type').withAttributes({fieldType: '@cardstack/core-types::string'}),
      factory.addResource('fields', 'sha-sum').withAttributes({fieldType: '@cardstack/core-types::string'}),
      factory.addResource('fields', 'file-name').withAttributes({fieldType: '@cardstack/core-types::string'}),
      factory.addResource('fields', 'size').withAttributes({fieldType: '@cardstack/core-types::integer'})
    ])
    .withRelated('data-source', storeFilesIn);

  return factory.getModels();
};