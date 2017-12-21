// FIXME: this file is currently duplicated into a browser version
// (this one) and a node version (see ../jsonapi-factory.js). Need to
// do obnoxious build-time thing to make one thing work both ways.

import DAGMap from 'dag-map';
let idGenerator = 0;

export default class JSONAPIFactory {
  constructor() {
    this.data = [];
  }

  addResource(type, id=null) {
    if (id == null) {
      id = idGenerator++;
    }
    let resource = { type, id: String(id) };
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
    let dag = new DAGMap();
    this.data.forEach(model => {
      let dependsOn = [];
      if (model.relationships) {
        Object.keys(model.relationships).forEach(rel => {
          let data = model.relationships[rel].data;
          if (Array.isArray(data)) {
            dependsOn = dependsOn.concat(data.map(ref => `${ref.type}/${ref.id}`));
          } else {
            dependsOn.push(`${data.type}/${data.id}`);
          }
        });
      }
      // A model implicitly depends on its type, so include it if it was defined
      // by this factory.
      // But in acceptance tests this factory may be combined with other data sources,
      // and the type may be defined there instead.
      if (this.data.some(r => r.type === 'content-types' && r.id === model.type)) {
        dependsOn.push(`content-types/${model.type}`);
      }

      // These are all boostrap schema and we need to not include them
      // here to avoid circularity.
      dependsOn = dependsOn.filter(dep => {
        return ![
          'content-types/content-types',
          'content-types/fields',
          'fields/fields'
        ].includes(dep);
      });

      dag.add(`${model.type}/${model.id}`, model, [], dependsOn);
    });
    let output = [];
    dag.each((key, value) => output.push(value));
    return output;
  }

  importModels(models) {
    this.data = this.data.concat(models);
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
