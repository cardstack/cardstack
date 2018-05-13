const Error = require('@cardstack/plugin-utils/error');
const Session = require('@cardstack/plugin-utils/session');
const { declareInjections } = require('@cardstack/di');
const { partition, uniqWith, isEqual, uniq } = require('lodash');

module.exports = declareInjections({
  schemaLoader: 'hub:schema-loader'
},

class Schema {
  static create(opts) {
    return new this(opts);
  }

  constructor({ types, fields, dataSources, inputModels, plugins, schemaLoader, grants }) {
    this.types = types;
    this.fields = fields;
    this.dataSources = dataSources;
    this.plugins = plugins;
    this._mapping = null;
    this._customAnalyzers = null;
    this._originalModels = inputModels;
    this._allGrants = grants;
    this._abstractRealms = null;
    this.schemaLoader = schemaLoader;
  }

  equalTo(otherSchema) {
    return otherSchema && isEqual(
      new Set(this._originalModels),
      new Set(otherSchema._originalModels)
    );
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
  async applyChanges(changes) {
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
    let newSchema = await this.applyChanges([{type, id, document: pendingChange.finalDocument}]);
    if (newSchema !== this) {
      return newSchema;
    }
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

  customAnalyzers() {
    if (!this._customAnalyzers) {

      let allAnalyzers;
      for (let contentType of this.types.values()) {
        let analyzers = contentType.customAnalyzers();
        if (analyzers) {
          if (!allAnalyzers) {
            allAnalyzers = {};
          }
          Object.assign(allAnalyzers, analyzers);
        }
      }

      if (allAnalyzers) {
        this._customAnalyzers = allAnalyzers;
      }
    }

    return this._customAnalyzers;
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

  _readAuthIncluded(included, userRealms) {
    let modified = false;
    let safeIncluded = included.map(resource => {
      let contentType = this.types.get(resource.type);
      if (contentType) {
        let authorized = contentType.applyReadAuthorization(resource, userRealms);
        if (authorized !== resource) {
          modified = true;
        }
        return authorized;
      }
    });
    if (modified) {
      return safeIncluded.filter(Boolean);
    } else {
      return included;
    }
  }

  async hasLoginAuthorization(potentialSession=Session.EVERYONE) {
    let userRealms = await potentialSession.realms();

    if (!potentialSession.type) {
      return;
    }

    let userType = this.types.get(potentialSession.type);
    if (!userType) {
      return;
    }

    return userType.hasLoginAuthorization(userRealms);
  }

  // This takes an arbitrary JSON:API document and makes it safe to
  // show within the given context. If it can't be shown at all
  // (because the primary resource is not readable), we return
  // undefined.
  //
  // Otherwise, we go through each included resource and field to
  // ensure there are valid grants for them. We return a new sanitized
  // document that strips out any included resources or fields that
  // were lacking grants.
  async applyReadAuthorization(document, context={}) {
    if (!document.data) {
      return;
    }

    let session = context.session || Session.EVERYONE;
    let userRealms = await session.realms();

    let authorizedResource;
    if (Array.isArray(document.data)) {
      authorizedResource = document.data.map(resource => {
        if (resource.id == null || resource.type == null) {
          return;
        }

        let type = this.types.get(resource.type);
        if (!type) {
          return;
        }
        return type.applyReadAuthorization(resource, userRealms);
      }).filter(Boolean);
    } else {
      if (document.data.id == null || document.data.type == null) {
        return;
      }

      let primaryType = this.types.get(document.data.type);
      if (!primaryType) {
        return;
      }

      authorizedResource = primaryType.applyReadAuthorization(document.data, userRealms);
      if (!authorizedResource) {
        return;
      }
    }

    let output = document;

    if (document.data !== authorizedResource) {
      output = {
        data: authorizedResource
      };
      if (document.meta) {
        output.meta = document.meta;
      }
    }

    if (document.included) {
      let safeIncluded = this._readAuthIncluded(document.included, userRealms);
      if (safeIncluded === document.included) {
        // the include list didn't need to be modified. If our output
        // is a modified copy, we need to bring the original included
        // list along. If our document is not a copy, it already has
        // the original included list.
        if (output !== document) {
          output.included = document.included;
        }
      } else {
        // we need to modify included. First copy the output document
        // if we didn't already.
        if (output === document) {
          output = { data: document.data };
          if (document.meta) {
            output.meta = document.meta;
          }
        }
        output.included = safeIncluded;
      }
    }

    if (output !== document && output.included) {
      // we altered something, so lets verify "full linkage" as
      // required by the spec
      // http://jsonapi.org/format/#document-compound-documents


      let allResources = new Map();
      if (Array.isArray(output.data)) {
        for (let resource of output.data) {
          allResources.set(`${resource.type}/${resource.id}`, resource);
        }
      } else {
        allResources.set(`${output.data.type}/${output.data.id}`, output.data);
      }

      if (output.included) {
        for (let resource of output.included) {
          allResources.set(`${resource.type}/${resource.id}`, resource);
        }
      }

      let reachable = new Set();
      let pending = Array.isArray(output.data) ? output.data.slice() : [output.data];

      while (pending.length > 0) {
        let resource = pending.pop();
        if (!resource.relationships) {
          continue;
        }

        for (let value of Object.values(resource.relationships)) {
          if (value && value.data) {
            let references;
            if (Array.isArray(value.data)) {
              references = value.data;
            } else {
              references = [value.data];
            }
            for (let { type, id } of references) {
              let key = `${type}/${id}`;
              if (!reachable.has(key)) {
                reachable.add(key);
                let resource = allResources.get(key);
                if (resource) {
                  pending.push(resource);
                }
              }
            }
          }
        }
      }
      let linkedIncluded = output.included.filter(resource => reachable.has(`${resource.type}/${resource.id}`));
      if (linkedIncluded.length < output.included.length) {
        // must replace output.included. output is necessarily already
        // copied (or we wouldn't be checking linkage in the first
        // place)
        output.included = linkedIncluded;
      }
    }

    return output;
  }

  authorizedReadRealms(type, resource) {
    let contentType = this.types.get(type);
    if (contentType) {
      return contentType.authorizedReadRealms(resource);
    } else {
      return [];
    }
  }

  // This gives us the complete set of realms that are in use by this
  // schema. They are "abstract" because they can be data-dependent.
  abstractRealms() {
    if (!this._abstractRealms) {
      this._abstractRealms = uniqWith(this._allGrants.map(({ who }) => {
        let [statics, dynamics] = partition(who, (entry) => entry.staticRealm);
        return {
          statics: statics.map(s => s.staticRealm),
          dynamicSlots: dynamics.length
        };
      }), isEqual);
    }
    return this._abstractRealms;
  }

  userRealms(userDoc) {
    let contentType = this.types.get(userDoc.type);
    if (!contentType || !contentType.isGroupable()) {
      return;
    }
    let groups = contentType.groups(userDoc).map(group => Session.encodeBaseRealm('groups', group.id));
    let ownBaseRealm = Session.encodeBaseRealm(userDoc.type, userDoc.id);
    if (groups.length === 0) {
      // if you're not in any groups, only your own base realm matters
      return [ownBaseRealm];
    } else {
      // this finds all the in-use abstract realms that the user
      // (represented by `doc`) might have access to, based on the
      // static group requirements in each one.
      let hits = this.abstractRealms().filter(abstractRealm => abstractRealm.statics.every(realm => groups.includes(realm)));

      // And this fills in any dynamic slots with our own base realm,
      // which is the only case I'm supporting for now. We could
      // support more full combinatoric expansion so that dynamic
      // slots can be filled with groups, but I don't need that
      // feature and it's potentially expensive.
      return hits.map(abstractRealm => {
        if (abstractRealm.dynamicSlots > 0) {
          return uniq([...abstractRealm.statics, ownBaseRealm]).sort().join('/');
        } else {
          return uniq(abstractRealm.statics).sort().join('/');
        }
      });
    }

  }

});
