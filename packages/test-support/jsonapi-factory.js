let idGenerator = 0;

class JSONAPIFactory {
  constructor() {
    this.data = [];
  }

  addResource(type, id=null) {
    if (id == null) {
      id = String(idGenerator++);
    }
    let resource = { type, id };
    this.data.push(resource);
    resource.type = type;
    return new ResourceFactory(resource);
  }

  getResource(type, id) {
    let resource = this.data.find(r => r.type === type && r.id === String(id));
    if (!resource) {
      throw new Error(`no such resource ${type} ${id}`);
    }
    return new ResourceFactory(resource);
  }

  getModels() {
    return this.data.slice();
  }

}

class ResourceFactory {
  constructor(data) {
    this.data = data;
    this.id = data.id;
    this.type = data.type;
  }
  withAttributes(attrs) {
    for (let [fieldName, value] of Object.entries(attrs)) {
      if (!this.data.attributes) {
        this.data.attributes = {};
      }
      this.data.attributes[dasherize(fieldName)] = value;
    }
    return this;
  }
  withRelated(fieldName, value) {
    if (!value) {
      throw new Error(`No value for ${fieldName}`);
    }
    if (!this.data.relationships) {
        this.data.relationships = {};
    }
    let data;
    if (Array.isArray(value)) {
      data = value.map(entry => ({ type: entry.type, id: entry.id}));
    } else {
      data ={ type: value.type, id: value.id};
    }
    this.data.relationships[dasherize(fieldName)] = { data };
    return this;
  }
}

function dasherize(camelCase) {
  return camelCase.replace(/([a-z])([A-Z])/g, (a,b,c) => `${b}-${c.toLowerCase()}`);
}

module.exports = JSONAPIFactory;
