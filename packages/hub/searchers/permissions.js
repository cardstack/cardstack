const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');
const find = require('../async-find');

module.exports = declareInjections({
  currentSchema: 'hub:current-schema',
  searchers: 'hub:searchers'
},

class PermissionsSearcher {
  static create(...args) {
    return new this(...args);
  }
  constructor({ dataSource, currentSchema, searchers}) {
    this.dataSource = dataSource;
    this.currentSchema = currentSchema;
    this.searchers = searchers;
  }

  //TODO rename 'type'
  async get({ session, sourceId, type, id, snapshotVersion, next }) {
    if (type !== 'permissions') {
      return next();
    }

    let [ queryType, queryId ] = id.split('/');

    let context = { session, type: queryType };

    let contentType = (await this.currentSchema.getSchema()).types.get(queryType);
    if (!contentType) {
      throw new Error(`content type "${queryType}" not found`, {
        status: 404,
        title: 'Missing content type'
      });
    }

    let mayUpdateResource = true;
    let document;
    if (!queryId) {
      // We're fetching permissions for a new resource
      // Checking grants should always happen on a document
      // so in the case we don't have one to check, we need to
      // to assemble a document from what we know about the fields
      document = {
        data: {
          type: queryType
        },
      };
    } else {
      document = await this.searchers.get(session, 'local-hub', queryType, queryId);
      if (!document) { return; } // we don't have it or don't have permission to read it
    }

    try {
      await contentType._assertGrant([document.data], context, 'may-update-resource', 'update');
    } catch(err) {
      if (!err.isCardstackError) {
        throw err;
      }
      mayUpdateResource = false;
    }
    // let sourceId = contentType.dataSource.id;
    let documentContext = this.searchers.createDocumentContext({
      id: document.data.id,
      type: document.data.type,
      sourceId,
      schema: await this.currentSchema.getSchema(),
      upstreamDoc: document
    });

    let writableFields = await Promise.all([...contentType.realFields.values()].map(async field => {
      // there has to be a grant that gives both reading and writing perm
      // on the field for it to be considered writable
      let readGrant = await find(field.grants, async g => {
        return g['may-read-fields'] && await g.matches(documentContext, context);
      });
      if (!readGrant) {
        return;
      }

      let writeGrant = await find(field.grants, async g => {
        return g['may-write-fields'] && await g.matches(documentContext, context);
      });
      if (writeGrant) {
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

  async search({ session, query, next }) {
    return next();
  }

});
