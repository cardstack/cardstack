const { declareInjections } = require('@cardstack/di');
const find = require('../async-find');

module.exports = declareInjections({
  schema: 'hub:current-schema',
  searchers: 'hub:searchers'
},

class PermissionsSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, schema, searchers}) {
    this.dataSource = dataSource;
    this.schema = schema;
    this.searchers = searchers;
  }

  async get(session, branch, type, id, next) {
    if (type !== 'permissions') {
      return next();
    }

    let [ queryType, queryId ] = id.split('/');
    // TODO: check for null queryId (no '/' in id)

    let contentType = (await this.schema.forBranch(branch)).types.get(queryType);
    // TODO: check for missing content type

    let document = await this.searchers.get(session, branch, queryType, queryId);
    if (!document) { return; } // we don't have it or don't have permission to read it

    let context = { session, type: queryType };

    let mayUpdateResource = true;
    try {
      await contentType._assertGrant([document.data], context, 'may-update-resource', 'update');
    } catch(err) {
      if (!err.isCardstackError) {
        throw err;
      }
      mayUpdateResource = false;
    }

    // todo: a field should only be writable if it is also readable. See how _validateFieldReadAuth does it.
    let writableFields = await Promise.all([...contentType.realAndComputedFields.values()].map(async field => {
      let grant = await find(field.grants, async g => g['may-write-fields'] && await g.matches(document.data, context));
      if (grant) {
        return field;
      }
    }));

    return {
      data: {
        type: 'permissions',
        id,
        attributes: {
          'may-update-resource': mayUpdateResource,
          'may-delete-resource': false,
        },
        relationships: {
          'writable-fields': {
            data: writableFields.filter(Boolean).map(f => ({type: 'fields', id: f.id}))
          }
        }
      }
    };
  }

  async search(session, branch, query, next) {
    return next();
  }

});
