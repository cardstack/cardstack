const authLog = require('@cardstack/logger')('cardstack/auth');
const log = require('@cardstack/logger')('cardstack/indexing/document-context');
const Model = require('../model');
const { getPath } = require('@cardstack/routing/cardstack/router-utils');
const { get, uniqBy } = require('lodash');

module.exports = class DocumentContext {

  constructor({ read, plugins, schema, type, id, branch, sourceId, generation, upstreamDoc, includePaths }) {
    if (upstreamDoc && !upstreamDoc.data) {
      throw new Error('The upstreamDoc must have a top-level "data" property', {
        status: 400
      });
    }
    this.schema = schema;
    this.plugins = plugins;
    this.type = type;
    this.id = id;
    this.branch = branch;
    this.sourceId = sourceId;
    this.generation = generation;
    this.upstreamDoc = upstreamDoc;
    this.includePaths = includePaths ? includePaths.map(part => part ? part.split('.') : null).filter(i => Boolean(i)) : [];
    this._read = read;
    this._realms = [];
    this._pendingReads = [];
    this._followedRelationships = {};
    this._routingCardId = get(upstreamDoc, 'meta.routing-card.data.id');
    this._routingCardType = get(upstreamDoc, 'meta.routing-card.data.type');
    this.cache = {};
    this.isCollection = upstreamDoc && upstreamDoc.data && Array.isArray(upstreamDoc.data);
    this.suppliedIncluded = upstreamDoc && upstreamDoc.included;

    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this._references = [];

    // special case for the built-in implicit relationship between
    // user-realms and the underlying user record it is tracking
    let user = get(upstreamDoc, 'data.relationships.user.data');
    if (type === 'user-realms' && user) {
      this._references.push(`${user.type}/${user.id}`);
    }
  }

  async searchDoc() {
    if (this.isCollection) { return; }

    let searchDoc = await this._buildCachedResponse();
    if (!searchDoc) { return; }

    return searchDoc;
  }

  async pristineDoc() {
    await this._buildCachedResponse();
    return this._pristine;
  }

  async realms() {
    if (this.isCollection) { return; }

    await this._buildCachedResponse();
    return this._realms;
  }

  async references() {
    if (this.isCollection) { return; }

    await this._buildCachedResponse();
    return this._references;
  }

  async read(type, id, notAReference) {
    log.debug(`Reading record ${type}/${id}`);

    if (!notAReference) {
      this._references.push(`${type}/${id}`);
    }

    let key = `${type}/${id}`;
    if (get(this, 'upstreamDoc.data.id') === id && get(this, 'upstreamDoc.data.type') === type) {
      return this.upstreamDoc.data;
    }

    let includedResource = this.suppliedIncluded ? this.suppliedIncluded.find(i => key === `${i.type}/${i.id}`) : null;
    if (includedResource) {
      return includedResource;
    }

    let cached = this.cache[key];
    if (cached) {
      return await cached;
    }

    // Remove this trap after we have figured out the root cause of the DocumentContext.read out-of-control recursion
    if (this._pendingReads.includes(key)) {
      throw new Error(`Cycle encountered in DocumentContext.read for ${this.type}/${this.id}. Pending resource reads are ${JSON.stringify(this._pendingReads)}`);
    }
    this._pendingReads.push(key);

    this.cache[key] = this._read(type, id);
    let resource = await this.cache[key];

    this._pendingReads = this._pendingReads.filter(i => i !== key);
    return resource;
  }

  // TODO come up with a better way to cache (use Model)
  async _buildCachedResponse() {
    let searchTree;
    if (!this.isCollection) {
      let contentType = this.schema.types.get(this.type);
      if (!contentType) { return; }

      searchTree = contentType.includesTree;
    }

    if (!this._searchDoc) {
      log.debug(`Building ${this.type}/${this.id}`);
      this._searchDoc = await this._build(this.type, this.id, this.upstreamDoc, searchTree, 0);
    }
    if (this._searchDoc) {
      return Object.assign({}, this._searchDoc);
    }
  }

  // copies attribues appropriately from jsonapiDoc into
  // pristineDocOut and searchDocOut.
  async _buildAttributes(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (field.id === 'id' || field.id === 'type' || field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.attributes && jsonapiDoc.attributes.hasOwnProperty(field.id))) {
        let value = await userModel.getField(field.id);
        await this._buildAttribute(field, value, pristineDocOut, searchDocOut);
      }
     }
  }

  async _buildAttribute(field, value, pristineDocOut, searchDocOut) {
    // Write our value into the search doc
    searchDocOut[field.id] = field.searchIndexFormat(value);
    // Write our value into the pristine doc
    ensure(pristineDocOut, 'attributes')[field.id] = value;
  }

  async _buildRelationships(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut, searchTree, depth, fieldsets) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (!field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.relationships && jsonapiDoc.relationships.hasOwnProperty(field.id))) {
        let value = { data: await userModel.getField(field.id) };
        let fieldset = fieldsets && fieldsets.find(f => f.field === field.id);
        await this._buildRelationship(field, value, pristineDocOut, searchDocOut, searchTree, depth, get(fieldset, 'format'));
      }
    }
  }

  async _buildRelationship(field, value, pristineDocOut, searchDocOut, searchTree, depth, format) {
    if (!value || !value.hasOwnProperty('data')) {
      return;
    }
    let related;
    if (value.data && searchTree[field.id]) {
      if (Array.isArray(value.data)) {
        related = await Promise.all(value.data.map(async ({ type, id }) => {
          let resource = await this.read(type, id);
          if (resource) {
            return this._build(type, id, resource, searchTree[field.id], depth + 1, format);
          }
        }));
        related = related.filter(Boolean);
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data: related.map(r => ({ type: r.type, id: r.id })) });
      } else {
        let resource = await this.read(value.data.type, value.data.id);
        if (resource) {
          related = await this._build(resource.type, resource.id, resource, searchTree[field.id], depth + 1, format);
        }
        let data = related ? { type: related.type, id: related.id } : null;
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data });
      }
    } else {
      related = value.data;
      ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value);
    }
    searchDocOut[field.id] = related;
  }

  _buildSearchTree(searchTree, segments) {
    if (!segments.length) { return {}; }

    searchTree[segments[0]] = this._buildSearchTree(Object.assign({}, searchTree), segments.slice(1));

    return searchTree;
  }

  async _addSelfLink(jsonapiDoc) {
    if (this._routingCardId && this._routingCardType && this.plugins) {
      let routingCard = await this.read(this._routingCardType, this._routingCardId, true);
      let path = await getPath(this.plugins,
                               this.schema,
                               { data: routingCard },
                               { data: jsonapiDoc },
                               get(this.upstreamDoc, 'meta.using-default-router'));
      if (path) {
        jsonapiDoc.links = jsonapiDoc.links || {};
        jsonapiDoc.links.self = path;
      }
    }
  }

  async _build(type, id, jsonapiDoc, searchTree, depth, fieldsetFormat) {
    let isCollection = this.isCollection && depth === 0;
    // we store the id as a regular field in elasticsearch here, because
    // we use elasticsearch's own built-in _id for our own composite key
    // that takes into account branches.
    //
    // we don't store the type as a regular field in elasticsearch,
    // because we're keeping it in the built in _type field.
    let searchDoc = isCollection ? {} : { ['id']: id };

    // this is the copy of the document we will return to anybody who
    // retrieves it. It's supposed to already be a correct jsonapi
    // response, as opposed to the searchDoc itself which is mangled
    // for searchability.
    let pristine = isCollection ? { data: [] } : { data: { id, type } };
    let rootItems = [];

    if (isCollection) {
      for (let [index, resource] of jsonapiDoc.data.entries()) {
        let contentType = this.schema.types.get(resource.type);
        if (!contentType) { continue; }

        let includesTree;
        if (this.includePaths.length) {
          includesTree = {};
          for (let segments of this.includePaths) {
            this._buildSearchTree(includesTree, segments);
          }
        } else {
          includesTree = Object.assign({}, contentType.includesTree);
        }

        let pristineItem = await this._build(resource.type, resource.id, resource, includesTree, depth + 1);
        assignMeta(pristineItem, jsonapiDoc.data[index]);

        pristine.data.push(pristineItem);
        rootItems.push(`${resource.type}/${resource.id}`);
      }
      assignMeta(pristine, jsonapiDoc);
    } else {
      let contentType = this.schema.types.get(type);
      if (!contentType) {
        log.warn("ignoring unknown document type=%s id=%s", type, id);
        return;
      }

      if (depth === 0 && this.includePaths.length){
        searchTree = {};
        for (let segments of this.includePaths) {
          this._buildSearchTree(searchTree, segments);
        }
      }

      let fieldsets = get(contentType, `fieldsets.${fieldsetFormat || contentType.fieldsetExpansionFormat}`);
      if (fieldsets && fieldsets.length) {
        for (let { field } of fieldsets) {
          this._buildSearchTree(searchTree, [ field ]);
        }
      }

      if (depth > 0) {
        // we are going inside a parent document's includes, so we need
        // our own type here.
        searchDoc['type'] = type;
      } else {
        jsonapiDoc = jsonapiDoc.data;
      }
      let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this));
      await this._buildAttributes(contentType, jsonapiDoc, userModel, pristine, searchDoc);

      if (!this._followedRelationships[`${type}/${id}`]) {
        this._followedRelationships[`${type}/${id}`] = true;
        await this._buildRelationships(contentType, jsonapiDoc, userModel, pristine, searchDoc, searchTree, depth, fieldsets);
      }

      assignMeta(pristine.data, jsonapiDoc);
    }

    if (depth === 0) {
      this.pristineIncludes = this.pristineIncludes.filter(r => !rootItems.includes(`${r.type}/${r.id}`));
    }

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      pristine.included = uniqBy([pristine].concat(this.pristineIncludes), r => `${r.type}/${r.id}`)
        .slice(1)
        .filter(r => !(r.type == type && r.id == id));
    }

    await this._addSelfLink(jsonapiDoc);

    if (depth > 0) {
      this.pristineIncludes.push(jsonapiDoc);
    } else {
      this._pristine = pristine;
      if (!isCollection) {
        if (this.sourceId != null) {
          this._pristine.data.meta.source = this.sourceId;
        }
        this._realms = this.schema.authorizedReadRealms(type, jsonapiDoc);
        authLog.trace("setting resource_realms for %s %s: %j", type, id, this._realms);
      }
    }
    if (this.isCollection && depth === 1) {
      return pristine.data;
    }
    return searchDoc;
  }

};

function assignMeta(pristine, resource) {
  if (resource.meta) {
    pristine.meta = Object.assign({}, resource.meta);
  } else {
    pristine.meta = {};
  }
}

function ensure(obj, section) {
  if (!obj.data[section]) {
    obj.data[section] = {};
  }
  return obj.data[section];
}
