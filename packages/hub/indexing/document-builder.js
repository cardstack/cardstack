const log = require('@cardstack/logger')('cardstack/hub/indexing');
const Model = require('../model');
const { uniqBy } = require('lodash');

module.exports = class DocumentBuilder {
  constructor({ schema, type, id, doc, fieldMapping, getResource }) {
    this.schema = schema;
    this.type = type;
    this.id = id;
    this.doc = doc;
    this._fieldMapping = fieldMapping ? fieldMapping : fieldName => fieldName; //TODO need a less ES specific way of approaching this
    this._getResource = getResource;

    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this.references = [];

    // All the ES specific stuff accumulates in this property so that the build() output is pure JSONAPI
    this.additionalEsFields = {}; // TODO eventually need to refactor this out of here
  }

  async read(type, id) {
    this.references.push(`${type}/${id}`);
    return this._getResource(type, id);
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
    let esName = await this._fieldMapping(field.id);
    searchDocOut[esName] = value;

    // Write our value into the pristine doc
    ensure(pristineDocOut, 'attributes')[field.id] = value;

    // If the search plugin has any derived fields, those also go
    // into the search doc.
    let derivedFields = field.derivedFields(value);
    if (derivedFields) {
      for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
        let esName = await this._fieldMapping(derivedName);
        searchDocOut[esName] = derivedValue;
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
            return this.build(type, id, resource, searchTree[field.id], depth + 1);
          }
        }));
        related = related.filter(Boolean);
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data: related.map(r => ({ type: r.data.type, id: r.data.id })) });
      } else {
        let resource = await this.read(value.data.type, value.data.id);
        if (resource) {
          related = await this.build(resource.type, resource.id, resource, searchTree[field.id], depth + 1);
        }
        let data = related ? { type: related.data.type, id: related.data.id } : null;
        ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value, { data });
      }
    } else {
      related = value.data;
      ensure(pristineDocOut, 'relationships')[field.id] = Object.assign({}, value);
    }

    // TODO eventually get this out of here...
    if (depth == 0) {
      let esName = await this._fieldMapping(field.id);

      if (Array.isArray(related)) {
        related = related.map(rec => flattenJsonapi(rec));
      } else if (related && related instanceof Object) {
        related = flattenJsonapi(related);
      }

      searchDocOut[esName] = related;
    }
  }

  async build(type, id, jsonapiDoc, searchTree, depth) {
    //TODO use class members fields for type, id and doc when not supplied as params

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
      let esId = await this._fieldMapping('id');
      this.additionalEsFields = { [esId]: id };
    }

    // this is the copy of the document we will return to anybody who
    // retrieves it. It's supposed to already be a correct jsonapi
    // response, as opposed to the searchDoc itself which is mangled
    // for searchability.
    let resultDoc = {
      data: { id, type }
    };

    // we are going inside a parent document's includes, so we need
    // our own type here.
    if (depth > 0) {
      let esType = await this._fieldMapping('type');
      this.additionalEsFields[esType] = type;
    }

    let userModel = new Model(contentType, jsonapiDoc, this.schema, this.read.bind(this));
    let esFieldsToAdd = {}; //TODO need a less ES specific way of approaching this
    await this._buildAttributes(contentType, jsonapiDoc, userModel, resultDoc, esFieldsToAdd);
    await this._buildRelationships(contentType, jsonapiDoc, userModel, resultDoc, esFieldsToAdd, searchTree, depth);

    if (depth === 0) {
      for (let field of Object.keys(esFieldsToAdd)) {
        this.additionalEsFields[field] = esFieldsToAdd[field];
      }
    }

    // top level document embeds all the other pristine includes
    if (this.pristineIncludes.length > 0 && depth === 0) {
      resultDoc.included = uniqBy([resultDoc].concat(this.pristineIncludes), r => `${r.type}/${r.id}`).slice(1);
    }

    if (jsonapiDoc.meta) {
      resultDoc.data.meta = Object.assign({}, jsonapiDoc.meta);
    } else {
      resultDoc.data.meta = {};
    }

    if (depth > 0) {
      this.pristineIncludes.push(resultDoc.data);
    }
    return resultDoc;
  }
};

function ensure(obj, section) {
  if (!obj.data[section]) {
    obj.data[section] = {};
  }
  return obj.data[section];
}

function flattenJsonapi(jsonApi) {
  if (jsonApi.data) {
    jsonApi = jsonApi.data;
  }
  let flattenedRecord = {
    id: jsonApi.id,
    type: jsonApi.type
  };
  for (let attr of Object.keys(jsonApi.attributes || {})) {
    flattenedRecord[attr] = jsonApi.attributes[attr];
  }
  return flattenedRecord;
}
