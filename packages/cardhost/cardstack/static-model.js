const Factory = require('@cardstack/test-support/jsonapi-factory');

let factory = new Factory();
factory
  .addResource('grants', 'world-read')
  .withAttributes({
    mayReadFields: true,
    mayReadResource: true,
  })
  .withRelated('who', [{ type: 'groups', id: 'everyone' }]);

// TODO this is for testing only--eventually we should
// only use mock-auth in the development and test environments
factory
  .addResource('grants', 'mock-user-access')
  .withAttributes({
    mayWriteFields: true,
    mayReadFields: true,
    mayCreateResource: true,
    mayReadResource: true,
    mayUpdateResource: true,
    mayDeleteResource: true,
    mayLogin: true,
  })
  .withRelated('who', [{ type: 'mock-users', id: 'user1' }]);

module.exports = function() {
  return factory.getModels();
};
