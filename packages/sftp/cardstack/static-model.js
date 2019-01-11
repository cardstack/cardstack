const Factory = require('@cardstack/test-support/jsonapi-factory');


module.exports = function({ contentType }) {
  let factory = new Factory();

  factory.addResource('content-types', contentType)
    .withRelated('fields', [
      factory.addResource('fields', 'access-time').withAttributes({fieldType: '@cardstack/core-types::date'}),
      factory.addResource('fields', 'modify-time').withAttributes({fieldType: '@cardstack/core-types::date'}),
      factory.addResource('fields', 'file-name').withAttributes({fieldType: '@cardstack/core-types::string'}),
      factory.addResource('fields', 'size').withAttributes({fieldType: '@cardstack/core-types::integer'}),
      factory.addResource('fields', 'content-type').withAttributes({fieldType: '@cardstack/core-types::string'})
    ])
    .withRelated('data-source', {type: 'data-sources', id: 'sftp'});

  return factory.getModels();
};


