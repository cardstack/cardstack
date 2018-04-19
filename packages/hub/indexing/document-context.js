const authLog = require('@cardstack/logger')('cardstack/auth');
const { uniqBy } = require('lodash');

module.exports = class DocumentContext {

  constructor(branchUpdate, schema, type, id, doc) {
    this.branchUpdate = branchUpdate;
    this.schema = schema;
    this.type = type;
    this.id = id;
    this.doc = doc;


    // included resources that we actually found
    this.pristineIncludes = [];

    // references to included resource that were both found or
    // missing. We track the missing ones so that if they later appear
    // in the data we can invalidate to pick them up.
    this.references = [];
  }

  async searchDoc() {
    let contentType = this.schema.types.get(this.type);
    let searchTree = contentType ? contentType.includesTree : null;
    return this._build(this.type, this.id, this.doc, searchTree, 0);
  }

  async _logicalFieldToES(fieldName) {
    return this.branchUpdate.client.logicalFieldToES(this.branchUpdate.branch, fieldName);
  }

  async _build(type, id, jsonapiDoc, searchTree, depth) {
    // we store the id as a regular field in elasticsearch here, because
    // we use elasticsearch's own built-in _id for our own composite key
    // that takes into account branches.
    //
    // we don't store the type as a regular field in elasticsearch,
    // because we're keeping it in the built in _type field.
    let esId = await this._logicalFieldToES('id');
    let searchDoc = { [esId]: id };

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
      let esType = await this._logicalFieldToES('type');
      searchDoc[esType] = type;
    }

    if (jsonapiDoc.attributes) {
      pristine.data.attributes = jsonapiDoc.attributes;
      for (let attribute of Object.keys(jsonapiDoc.attributes)) {
        let value = jsonapiDoc.attributes[attribute];
        let field = this.schema.realFields.get(attribute);
        if (field) {
          let derivedFields = field.derivedFields(value);
          if (derivedFields) {
            for (let [derivedName, derivedValue] of Object.entries(derivedFields)) {
              let esName = await this._logicalFieldToES(derivedName);
              searchDoc[esName] = derivedValue;
            }
          }
        }
        let esName = await this._logicalFieldToES(attribute);
        searchDoc[esName] = value;
      }
    }
    if (jsonapiDoc.relationships) {
      let relationships = pristine.data.relationships = Object.assign({}, jsonapiDoc.relationships);


      for (let attribute of Object.keys(jsonapiDoc.relationships)) {
        let value = jsonapiDoc.relationships[attribute];
        let field = this.schema.realFields.get(attribute);
        if (field && value && value.hasOwnProperty('data')) {
          let related;
          if (value.data && searchTree[attribute]) {
            if (Array.isArray(value.data)) {
              related = await Promise.all(value.data.map(async ({ type, id }) => {
                this.references.push(`${type}/${id}`);
                let resource = await this.branchUpdate.read(type, id);
                if (resource) {
                  return this._build(type, id, resource, searchTree[attribute], depth + 1);
                }
              }));
              related = related.filter(Boolean);
              relationships[attribute] = Object.assign({}, relationships[attribute], { data: related.map(r => ({ type: r.type, id: r.id })) });
            } else {
              this.references.push(`${value.data.type}/${value.data.id}`);
              let resource = await this.branchUpdate.read(value.data.type, value.data.id);
              if (resource) {
                related = await this._build(resource.type, resource.id, resource, searchTree[attribute], depth + 1);
              } else {
                relationships[attribute] = Object.assign({}, relationships[attribute], { data: null });
              }

            }
          } else {
            related = value.data;
          }
          let esName = await this._logicalFieldToES(attribute);
          searchDoc[esName] = related;
        }
      }

    }

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
      searchDoc.cardstack_references = this.references;
      searchDoc.cardstack_realms = this.schema.authorizedReadRealms(type, jsonapiDoc);
      authLog.trace("setting resource_realms for %s %s: %j", type, id, searchDoc.cardstack_realms);
    }
    return searchDoc;
  }

};
