const authLog = require('@cardstack/logger')('cardstack/auth');
const log = require('@cardstack/logger')('cardstack/indexers');
const Model = require('../model');
const { uniqBy } = require('lodash');

module.exports = class DocumentContext {

  constructor({ read, schema, type, id, branch, sourceId, generation, upstreamDoc }) {
    this.schema = schema;
    this.type = type;
    this.id = id;
    this.branch = branch;
    this.sourceId = sourceId;
    this.generation = generation;
    this.upstreamDoc = upstreamDoc;
    this._read = read;

    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this._references = [];

    // special case for the built-in implicit relationship between
    // user-realms and the underlying user record it is tracking
    if (type === 'user-realms') {
      let user = upstreamDoc.relationships.user.data;
      this._references.push(`${user.type}/${user.id}`);
    }
  }

  async searchDoc() {
    let searchDoc = await this._getCachedSearchDoc();
    if (!searchDoc) { return; }

    // TODO adapting the searchdoc response to new structure available to pg-search, still need to refactor this internally to remove these deletes
    delete searchDoc.cardstack_pristine;
    delete searchDoc.cardstack_references;
    delete searchDoc.cardstack_realms;

    return searchDoc;
  }

  async pristineDoc() {
    let searchDoc = await this._getCachedSearchDoc();
    if (!searchDoc) { return; }

    let pristine = searchDoc.cardstack_pristine;
    pristine.data.meta.source = this.sourceId;

    return pristine;
  }

  async realms() {
    let searchDoc = await this._getCachedSearchDoc();
    if (!searchDoc) { return; }

    return searchDoc.cardstack_realms;
  }

  async references() {
    await this._getCachedSearchDoc(); // side effect builds up the references
    return this._references;
  }

  async read(type, id) {
    this._references.push(`${type}/${id}`);
    return this._read(type, id);
  }


  // TODO come up with a better way to cache (use Model)
  async _getCachedSearchDoc() {
    let contentType = this.schema.types.get(this.type);
    if (!contentType) {
      return;
    }
    if (!this._searchDoc) {
      this._searchDoc = await this._build(this.type, this.id, this.upstreamDoc, contentType.includesTree, 0);
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
    searchDocOut[field.id] = value;
    // Write our value into the pristine doc
    ensure(pristineDocOut, 'attributes')[field.id] = value;
  }

  async _buildRelationships(contentType, jsonapiDoc, userModel, pristineDocOut, searchDocOut, searchTree, depth) {
    for (let field of contentType.realAndComputedFields.values()) {
      if (!field.isRelationship) {
        continue;
      }
      if (contentType.computedFields.has(field.id) ||
          (jsonapiDoc.relationships && jsonapiDoc.relationships.hasOwnProperty(field.id))) {
        let value = { data: await userModel.getField(field.id) };
        await this._buildRelationship(field, value, pristineDocOut, searchDocOut, searchTree, depth);
      }
    }
  }

  async _buildRelationship(field, value, pristineDocOut, searchDocOut, searchTree, depth) {
    if (!value || !value.hasOwnProperty('data')) {
      return;
    }
    let related;
    if (value.data && searchTree[field.id]) {
      if (Array.isArray(value.data)) {
        related = await Promise.all(value.data.map(async ({ type, id }) => {
          let resource = await this.read(type, id);
          if (resource) {
            return this._build(type, id, resource, searchTree[field.id], depth + 1);
          }
        }));
        related = related.filter(Boolean);
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data: related.map(r => ({ type: r.type, id: r.id })) });
      } else {
        let resource = await this.read(value.data.type, value.data.id);
        if (resource) {
          related = await this._build(resource.type, resource.id, resource, searchTree[field.id], depth + 1);
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

  async _build(type, id, jsonapiDoc, searchTree, depth) {
    let contentType = this.schema.types.get(type);
    if (!contentType) {
      log.warn("ignoring unknown document type=%s id=%s", type, id);
      return;
    }

    // we store the id as a regular field in elasticsearch here, because
    // we use elasticsearch's own built-in _id for our own composite key
    // that takes into account branches.
    //
    // we don't store the type as a regular field in elasticsearch,
    // because we're keeping it in the built in _type field.
    let searchDoc = { ['id']: id };

    // this is the copy of the document we will return to anybody who
    // retrieves it. It's supposed to already be a correct jsonapi
    // response, as opposed to the searchDoc itself which is mangled
    // for searchability.
    let pristine = {
      data: { id, type }
    };

    // we are going inside a parent document's includes, so we need
    // our own type here.
    if (depth > 0) {
      searchDoc['type'] = type;
    }

    let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this));
    await this._buildAttributes(contentType, jsonapiDoc, userModel, pristine, searchDoc);
    await this._buildRelationships(contentType, jsonapiDoc, userModel, pristine, searchDoc, searchTree, depth);

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      pristine.included = uniqBy([pristine].concat(this.pristineIncludes), r => `${r.type}/${r.id}`).slice(1);
    }

    // The next fields in the searchDoc get a "cardstack_" prefix so
    // they aren't likely to collide with the user's attribute or
    // relationship.

    if (jsonapiDoc.meta) {
      pristine.data.meta = Object.assign({}, jsonapiDoc.meta);
    } else {
      pristine.data.meta = {};
    }

    if (depth > 0) {
      this.pristineIncludes.push(pristine.data);
    } else {
      searchDoc.cardstack_pristine = pristine;
      searchDoc.cardstack_references = this._references;
      searchDoc.cardstack_realms = this.schema.authorizedReadRealms(type, jsonapiDoc);
      authLog.trace("setting resource_realms for %s %s: %j", type, id, searchDoc.cardstack_realms);
    }
    return searchDoc;
  }

};

function ensure(obj, section) {
  if (!obj.data[section]) {
    obj.data[section] = {};
  }
  return obj.data[section];
}
