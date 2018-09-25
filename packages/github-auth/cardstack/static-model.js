const log = require('@cardstack/logger')('cardstack/github-auth/indexer');

module.exports = function({ dataSource, provideUserSchema }) {

  if (provideUserSchema === false) {
    return [];
  }

  if (dataSource.userRewriter){
    log.warn("If you use a custom user-rewriter on the github-auth data source, you should probably also set params.provideUserSchema=false and provide your own user model");
  }

  return [
    {
      type: 'content-types',
      id: 'github-users',
      attributes: {
      },
      relationships: {
        'fields': { data: [
          { type: 'fields', id: 'name' },
          { type: 'fields', id: 'email' },
          { type: 'fields', id: 'avatar-url' },
          { type: 'fields', id: 'permissions' }
        ] }
      }
    },
    {
      type: 'fields',
      id: 'name',
      attributes: {
        'field-type': '@cardstack/core-types::string'
      }
    },
    {
      type: 'fields',
      id: 'email',
      attributes: {
        'field-type': '@cardstack/core-types::string'
      }
    },
    {
      type: 'fields',
      id: 'avatar-url',
      attributes: {
        'field-type': '@cardstack/core-types::string'
      }
    },
    {
      type: 'fields',
      id: 'permissions',
      attributes: {
        'field-type': '@cardstack/core-types::object'
      }
    },
  ];
};
