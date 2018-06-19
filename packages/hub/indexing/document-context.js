const log = require('@cardstack/logger')('cardstack/indexing');
const DocumentBuilder = require('./document-builder');

module.exports = class DocumentContext {

  constructor(branchUpdate, schema, type, id, doc) {
    this.branchUpdate = branchUpdate;
    this.schema = schema;
    this.type = type;
    this.id = id;
    this.doc = doc;

    this.builder = new DocumentBuilder({
      schema,
      type,
      id,
      doc,
      getResource: async (type, id) => branchUpdate.read(type, id),
      fieldMapping: async (fieldName) => branchUpdate.client.logicalFieldToES(branchUpdate.branch, fieldName)
    });

    // special case for the built-in implicit relationship between
    // user-realms and the underlying user record it is tracking
    if (type === 'user-realms') {
      let user = doc.relationships.user.data;
      this.builder.references.push(`${user.type}/${user.id}`);
    }
  }

  async _logicalFieldToES(fieldName) {
    return this.branchUpdate.client.logicalFieldToES(this.branchUpdate.branch, fieldName);
  }

  async searchDoc() {
    let contentType = this.schema.types.get(this.type);
    if (!contentType) {
      return;
    }

    let jsonapiDoc = await this.builder.build(this.type, this.id, this.doc, contentType.includesTree, 0);
    let searchDoc = Object.assign({}, this.builder.additionalEsFields);

    // The next fields in the searchDoc get a "cardstack_" prefix so
    // they aren't likely to collide with the user's attribute or
    // relationship.
    searchDoc.cardstack_pristine = Object.assign({}, jsonapiDoc);
    searchDoc.cardstack_references = this.builder.references;
    searchDoc.cardstack_realms = this.schema.authorizedReadRealms(this.type, jsonapiDoc.data);
    log.trace("setting resource_realms for %s %s: %j", this.type, this.id, searchDoc.cardstack_realms);

    return searchDoc;
  }
};
