const Factory = require('@cardstack/test-support/jsonapi-factory');

// TODO this is for testing only--eventually we should
// only use mock-auth in the development and test environments
let factory = new Factory();
factory.addResource('grants', 'mock-user-access')
  .withAttributes({
    mayWriteFields: true,
    mayReadFields: true,
    mayCreateResource: true,
    mayReadResource: true,
    mayUpdateResource: true,
    mayDeleteResource: true,
    mayLogin: true
  })
  .withRelated('who', [{ type: 'mock-users', id: 'user1' }]);

module.exports = factory.getModels();
