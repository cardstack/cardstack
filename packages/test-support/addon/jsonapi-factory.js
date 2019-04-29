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


  getDocumentFor({type, id}) {
    let model;
    if (type != null && id != null) {
      model = this.data.find(i => i.id === id && i.type === type);
    }
    if (!model) { return; }

    let dag = new DAGMap();
    this._getModelsRelatedTo(model, dag);
    let output = { data: model };
    let included = [];
    dag.each((key, value) => {
      if (value && !(value.type === type && value.id === id)) {
        included.push(value);
      }
    });
    if (included.length) {
      output.included = included;
    }

    return output;
  }

  _getModelsRelatedTo(model, dag, relatedModels=[]) {
    let modelRefs = getModelDependencies(model, dag);
    for (let relatedModelRef of modelRefs) {
      if ([
        'content-types/content-types',
        'content-types/fields',
        'fields/fields'
      ].includes(relatedModelRef)) { continue; }

      let relatedModel = this.data.find(i => `${i.type}/${i.id}` === relatedModelRef);
      if (!relatedModel) { continue; }

      relatedModels.push(relatedModel);
      this._getModelsRelatedTo(relatedModel, dag, relatedModels);
    }
  }

  getModels() {
    let dag = new DAGMap();
    this.data.forEach(model => getModelDependencies(model, dag));

    let output = [];
    dag.each((key, value) => {
      if (value) {
        output.push(value);
      }
    });
    return output;
  }

  importModels(models) {
    this.data = this.data.concat(models);
  }
}

function getModelDependencies(model, dag) {
  let dependsOn = [];
  if (model.relationships) {
    Object.keys(model.relationships).forEach(rel => {
      let { data/*, links*/ } = model.relationships[rel];

      if (data) {
        if (Array.isArray(data)) {
          dependsOn = dependsOn.concat(data.map(ref => `${ref.type}/${ref.id}`));
        } else {
          dependsOn.push(`${data.type}/${data.id}`);
        }
      }
    });
  }

  dependsOn.push(`content-types/${model.type}`);

  // These are all bootstrap schema and we need to not include them
  // here to avoid circularity.
  dependsOn = dependsOn.filter(dep => {
    return ![
      'content-types/content-types',
      'content-types/fields',
      'fields/fields'
    ].includes(dep);
  });

  dag.add(`${model.type}/${model.id}`, model, [], dependsOn);
  return dependsOn;
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
      data = value.map(entry => ({ type: entry.type, id: entry.id }));
    } else {
      data = { type: value.type, id: value.id };
    }
    this.data.relationships[dasherize(fieldName)] = { data };
    return this;
  }
  withRelatedLink(fieldName, link) {
    if (!link) {
      throw new Error(`No link for ${fieldName}`);
    }
    if (typeof link !== 'string') {
      throw new Error(`Link must be a string: link is ${JSON.stringify(link, null, 2)}`);
    }
    if (!this.data.relationships) {
      this.data.relationships = {};
    }
    this.data.relationships[dasherize(fieldName)] = { links: { related: link } };
    return this;
  }
  asDocument() {
    return { data: this.data };
  }
}

function dasherize(camelCase) {
  return camelCase.replace(/([a-z])([A-Z])/g, (a,b,c) => `${b}-${c.toLowerCase()}`);
}
