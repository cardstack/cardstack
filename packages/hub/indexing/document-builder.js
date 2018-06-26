const authLog = require('@cardstack/logger')('cardstack/auth');
const log = require('@cardstack/logger')('cardstack/hub/indexing');
const Model = require('../model');
const { uniqBy } = require('lodash');

module.exports = class DocumentBuilder {

  constructor(branchUpdate, schema, type, id, doc) {
    this.branchUpdate = branchUpdate;
    this.schema = schema;
    this.type = type;
    this.id = id;
    this.doc = doc;
    this._pristineDoc = null;

    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this.references = [];

    // All the searchDoc embellishments accumulate in here
    this.searchDocFields = {};

    // special case for the built-in implicit relationship between
    // user-realms and the underlying user record it is tracking
    if (type === 'user-realms') {
      let user = doc.relationships.user.data;
      this.references.push(`${user.type}/${user.id}`);
    }
  }

  async pristineDoc() {
    let contentType = this.schema.types.get(this.type);
    if (!contentType) {
      return;
    }

    if (!this._pristineDoc) {
      this._pristineDoc = await this._build(this.type, this.id, this.doc, contentType.includesTree, 0);
    }

    return this._pristineDoc;
  }

  async searchDoc() {
    let contentType = this.schema.types.get(this.type);
    if (!contentType) {
      return;
    }

    let pristine = await this.pristineDoc();
    let searchDoc = Object.assign({}, this.searchDocFields);

    // The next fields in the searchDoc get a "cardstack_" prefix so
    // they aren't likely to collide with the user's attribute or
    // relationship.
    searchDoc.cardstack_pristine = Object.assign({}, pristine);
    searchDoc.cardstack_references = this.references;
    searchDoc.cardstack_realms = this.schema.authorizedReadRealms(this.type, pristine.data);
    authLog.trace("setting resource_realms for %s %s: %j", this.type, this.id, searchDoc.cardstack_realms);
    return searchDoc;
  }

  async read(type, id) {
    this.references.push(`${type}/${id}`);
    return this.branchUpdate.read(type, id);
  }

  async _addSearchDocField(field, value) {
    if (!this.searchDocFields) {
      this.searchDocFields = {};
    }

    let name = await this.branchUpdate.client.logicalFieldToES(this.branchUpdate.branch, field);

    if (Array.isArray(value)) {
      value = value.map(rec => flattenJsonapi(rec));
    } else if (value && value instanceof Object) {
      value = flattenJsonapi(value);
    }

    this.searchDocFields[name] = value;
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

    // If the search plugin has any derived fields, those also go
    // into the search doc.
    let derivedFields = field.derivedFields(value);
    if (derivedFields) {
      for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
        searchDocOut[derivedName] = derivedValue;
      }
    }
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
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data: related.map(r => ({ type: r.data.type, id: r.data.id })) });
      } else {
        let resource = await this.read(value.data.type, value.data.id);
        if (resource) {
          related = await this._build(resource.type, resource.id, resource, searchTree[field.id], depth + 1);
        }
        let data = related ? { type: related.data.type, id: related.data.id } : null;
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data });
      }
    } else {
      related = value.data;
      ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value);
    }

    if (depth === 0) {
      searchDocOut[field.id] = related;
    }
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
    if (depth === 0) {
      await this._addSearchDocField('id', id);
    }

    let doc = {
      data: { id, type }
    };

    let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this));
    let searchDocFields = {};
    await this._buildAttributes(contentType, jsonapiDoc, userModel, doc, searchDocFields);
    await this._buildRelationships(contentType, jsonapiDoc, userModel, doc, searchDocFields, searchTree, depth);

    if (depth === 0) {
      for (let field of Object.keys(searchDocFields)) {
        await this._addSearchDocField(field, searchDocFields[field]);
      }
    }

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      doc.included = uniqBy([doc].concat(this.pristineIncludes), r => `${r.type}/${r.id}`).slice(1);
    }

    if (jsonapiDoc.meta) {
      doc.data.meta = Object.assign({}, jsonapiDoc.meta);
    } else {
      doc.data.meta = {};
    }

    if (depth > 0) {
      this.pristineIncludes.push(doc.data);
    }
    return doc;
  }

};

function ensure(obj, section) {
  if (!obj.data[section]) {
    obj.data[section] = {};
  }
  return obj.data[section];
}

function flattenJsonapi(record) {
  // passthru if it doesn't look like json api
  if (!record.data) { return record; }

  let { data } = record;
  let { id, type } = data;
  let flattenedRecord = { id, type };

  for (let attr of Object.keys(data.attributes || {})) {
    flattenedRecord[attr] = data.attributes[attr];
  }
  return flattenedRecord;
}
