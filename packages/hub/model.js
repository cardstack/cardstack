// This implements the public interface that allows user-provided code
// (like computed fields) to access models.

const priv = new WeakMap();

module.exports = class Model {
  constructor(contentType, jsonapiDoc, schema, read) {
    priv.set(this, { contentType, jsonapiDoc, read, schema });
  }

  getContentType() {
    return priv.get(this).contentType;
  }

  async getField(fieldName) {
    let { contentType, jsonapiDoc } = priv.get(this);
    let field = contentType.realAndComputedFields.get(fieldName);
    if (!field) {
      throw new Error(`tried to access nonexistent field ${fieldName}`);
    }
    let computedField = contentType.computedFields.get(field.id);
    if (computedField) {
      return computedField.compute(this);
    } else if (field.isRelationship) {
      if (jsonapiDoc.relationships) {
        let relObj = jsonapiDoc.relationships[field.id];
        if (relObj) {
          return relObj.data;
        }
      }
    } else if (field.id === 'id' || field.id === 'type') {
      return jsonapiDoc[field.id];
    } else {
      return jsonapiDoc.attributes && jsonapiDoc.attributes[field.id];
    }
  }

  async getRelated(fieldName) {
    let refs = await this.getField(fieldName);
    if (Array.isArray(refs)) {
      return Promise.all(refs.map(ref => this.getModel(ref.type, ref.id)));
    } else if (refs) {
      return this.getModel(refs.type, refs.id);
    }
  }

  async getModel(type, id) {
    let { schema, read, jsonapiDoc } = priv.get(this);
    let contentType = schema.types.get(type);
    if (!contentType) {
      throw new Error(`${jsonapiDoc.type} ${jsonapiDoc.id} tried to getModel nonexistent type ${type} `);
    }
    let model = await read(type, id);
    if (!model) { return; }

    return new Model(contentType, model, schema, read);
  }

};
