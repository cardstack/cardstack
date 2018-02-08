const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schemaLoader: 'hub:schema-loader'
},

class Schema {
  static create(opts) {
    return new this(opts);
  }

  constructor({ types, fields, dataSources, inputModels, plugins, schemaLoader }) {
    this.types = types;
    this.fields = fields;
    this.dataSources = dataSources;
    this.plugins = plugins;
    this._mapping = null;
    this._originalModels = inputModels;
    this.schemaLoader = schemaLoader;
  }

  async teardown() {
    for (let source of this.dataSources.values()) {
      await source.teardown();
    }
  }

  isSchemaType(type) {
    return this.schemaLoader.ownTypes().includes(type);
  }

  // derives a new schema by adding, updating, or removing
  // models. Takes a list of { type, id, document } objects. A null document
  // means deletion.
  applyChanges(changes) {
    let models = this._originalModels;
    for (let change of changes) {
      let { type, id, document } = change;
      if (!this.isSchemaType(type)) {
        // not a schema model, so we can ignore it
        continue;
      }
      models = models.filter(m => m.type !== type || m.id !== id);
      if (document) {
        models.push(document);
      }
    }
    if (models === this._originalModels) {
      return this;
    } else {
      return this.schemaLoader.loadFrom(models);
    }
  }

  async validationErrors(pendingChange, context={}) {
    try {
      await this.validate(pendingChange, context);
      return [];
    } catch (err) {
      if (!err.isCardstackError) { throw err; }
      if (err.additionalErrors) {
        return [err].concat(err.additionalErrors);
      } else {
        return [err];
      }
    }
  }

  async validate(pendingChange, context={}) {
    let type, id;
    if (pendingChange.finalDocument) {
      // Create or update: check basic request document structure.
      this._validateDocumentStructure(pendingChange.finalDocument, context);
      type = pendingChange.finalDocument.type;
      id = pendingChange.finalDocument.id;
    } else {
      // Deletion. There's no request document to check.
      type = pendingChange.originalDocument.type;
      id = pendingChange.originalDocument.id;
    }

    let contentType = this.types.get(type);
    if (!contentType) {
      throw new Error(`"${type}" is not a valid type`, {
        status: 400,
        source: { pointer: '/data/type' }
      });
    }
    await contentType.validate(pendingChange, context);


    // Safety check: the change we're about to approve is a schema
    // change. The following will deliberately blow up if the new
    // schema hits a bug anywhere in schema instantiation. Better to
    // serve a 500 here than accept the broken schema and serve 500s
    // to everyone.
    let newSchema = this.applyChanges([{type, id, document: pendingChange.finalDocument}]);
    if (newSchema !== this) {
      return newSchema;
    }
  }

  realms(type, doc, outputSet=new Set()) {
    let contentType = this.types.get(type);
    if (contentType) {
      for (let grant of contentType.grants) {
        if (grant['may-read-resource']) {
          outputSet.add(grant.groupId);
        }
      }
    }
    return outputSet;
  }

  _validateDocumentStructure(document, context) {
    if (!document.type) {
      throw new Error(`missing required field "type"`, {
        status: 400,
        source: { pointer: '/data/type' }
      });
    }

    if (context.type != null) {
      if (document.type !== context.type) {
        throw new Error(`the type "${document.type}" is not allowed here`, {
          status: 409,
          source: { pointer: '/data/type' }
        });
      }
    }

    if (context.id != null) {
      if (!document.id) {
        throw new Error('missing required field "id"', {
          status: 400,
          source: { pointer: '/data/id' }
        });
      }
      if (String(document.id) !== context.id) {
        throw new Error('not allowed to change "id"', {
          status: 403,
          source: { pointer: '/data/id' }
        });
      }
    }
  }

  mapping() {
    if (!this._mapping) {
      this._mapping = {
        meta: {
          properties: {
            params: { type: 'object', enabled: false }
          }
        }
      };
      for (let contentType of this.types.values()) {
        this._mapping[contentType.id] = contentType.mapping();
        this._mapping[contentType.id].properties.cardstack_source = { type: 'keyword' };
        this._mapping[contentType.id].properties.cardstack_generation = { type: 'keyword' };
        this._mapping[contentType.id].properties.cardstack_pristine = { type: 'object', enabled: false };
        this._mapping[contentType.id].properties.cardstack_references = { type: 'keyword' };
        this._mapping[contentType.id].properties.cardstack_realms = { type: 'keyword' };
      }

    }
    return this._mapping;
  }


});
