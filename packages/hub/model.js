// This implements the public interface that allows user-provided code
// (like computed fields) to access models.
const priv = new WeakMap();
const qs = require('qs');

exports.privateModels = priv;

function isRelationshipObject(obj) {
  // json:api spec says you're also a valid relationship object if you have
  // only a "meta" property, but we don't really use that case, so we're not
  // including it here.
  return obj && (
    obj.hasOwnProperty('links') ||
    obj.hasOwnProperty('data')
  );
}

exports.Model = class Model {
  constructor(contentType, jsonapiDoc, schema, read, search) {
    priv.set(this, { contentType, jsonapiDoc, schema, read, search });
  }

  get id() {
    return priv.get(this).jsonapiDoc.id;
  }

  get type() {
    return priv.get(this).jsonapiDoc.type;
  }

  // derive source ID from the Model.id
  get sourceId() {
    return priv.get(this).sourceId;
  }

  // derive package name from the content type
  get packageName() {
    return priv.get(this).sourceId;
  }

  // derive card ID from the Model.id
  get cardId() {
    return priv.get(this).sourceId;
  }

  getContentType() {
    return priv.get(this).contentType;
  }

  getMeta() {
    let { jsonapiDoc } = priv.get(this);
    if (jsonapiDoc) {
      return jsonapiDoc.meta;
    }
  }

  async getField(fieldName) {
    let { contentType, jsonapiDoc } = priv.get(this);
    let field = contentType.realAndComputedFields.get(fieldName);
    if (!field) {
      throw new Error(`tried to access nonexistent field ${fieldName}`);
    }
    let computedField = contentType.computedFields.get(field.name);
    if (computedField) {
      let userValue = await computedField.compute(this);
      if (field.isRelationship && !isRelationshipObject(userValue)) {
        userValue = { data: userValue };
      }
      return userValue;
    } else if (field.isRelationship) {
      if (jsonapiDoc.relationships) {
        return jsonapiDoc.relationships[field.name];
      }
    } else if (field.id === 'id' || field.id === 'type') {
      return jsonapiDoc[field.name];
    } else {
      return jsonapiDoc.attributes && jsonapiDoc.attributes[field.name];
    }
  }

  async getRelated(fieldName) {
    let relObj = await this.getField(fieldName);
    let { contentType } = priv.get(this);
    let field = contentType.realAndComputedFields.get(fieldName);
    let isCollection = field.fieldType === '@cardstack/core-types::has-many';

    if (relObj && relObj.hasOwnProperty('links') && relObj.links.related) {
      let models = await this.getModels(qs.parse(relObj.links.related.split('/api?')[1]));
      if (isCollection) {
        return models;
      } else {
        return models[0];
      }
    }

    if (relObj && relObj.data) {
      let refs = relObj.data;
      if (Array.isArray(refs)) {
        return (await Promise.all(refs.map(ref => this.getModel(ref.type, ref.id)))).filter(Boolean);
      } else {
        return this.getModel(refs.type, refs.id);
      }
    }

    if (isCollection) {
      return [];
    } else {
      return null;
    }

  }

  async getModel(type, id) {
    let { schema, read, search, jsonapiDoc } = priv.get(this);
    let contentType = schema.types.get(type);
    if (!contentType) {
      throw new Error(`${jsonapiDoc.type} ${jsonapiDoc.id} tried to getModel nonexistent type ${type} `);
    }
    let model = await read(type, id);
    if (!model) { return; }

    return new Model(contentType, model, schema, read, search);
  }

  async getModels(query) {
    let { schema, search, read } = priv.get(this);

    let models = await search(query);
    if (!models) { return; }

    return models.data.map(model => new Model(schema.types.get(model.type), model, schema, read, search));
  }
};
