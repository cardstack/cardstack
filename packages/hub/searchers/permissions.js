const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schema: 'hub:current-schema',
},

class PermissionsSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, schema}) {
    this.dataSource = dataSource;
    this.schema = schema;
  }

  async get(session, branch, type, id, next) {
    if (type !== 'permissions') {
      return next();
    }
    return {
      data: {
        type: 'permissions',
        id,
        attributes: {
          'may-update-resource': true,
          'may-delete-resource': false,
        },
        relationships: {
          'writable-fields': {
            data: [
              { type: 'fields', id: 'title' }
            ]
          }
        }
      }
    };
  }

  async search(session, branch, query, next) {
    return next();
  }

});
