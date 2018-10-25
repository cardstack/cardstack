const Factory = require('@cardstack/test-support/jsonapi-factory');

let factory = new Factory();

factory.addResource('content-types', 'cs-files')
  .withRelated('fields', [
    factory.addResource('fields', 'created-at').withAttributes({fieldType: '@cardstack/core-types::date'}),
    factory.addResource('fields', 'content-type').withAttributes({fieldType: '@cardstack/core-types::string'}),
    factory.addResource('fields', 'sha-sum').withAttributes({fieldType: '@cardstack/core-types::string'}),
    factory.addResource('fields', 'file-name').withAttributes({fieldType: '@cardstack/core-types::string'}),
    factory.addResource('fields', 'size').withAttributes({fieldType: '@cardstack/core-types::integer'})
  ])
  .withRelated('data-source', {type: 'data-sources', id: 's3'});

module.exports = function(/* dataSourceParams */) {
  return factory.getModels();
};