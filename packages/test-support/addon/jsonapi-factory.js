import DAGMap from 'dag-map';
import { some } from 'lodash';

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
    let grants = this.data.filter(model => model.type === 'grants');
    let alreadyDependsOnGrants;
    this.data.forEach(model => {
      let dependsOn = [];
      if (model.relationships) {
        Object.keys(model.relationships).forEach(rel => {
          let data = model.relationships[rel].data;
          if (Array.isArray(data)) {
            dependsOn = dependsOn.concat(data.map(ref => `${ref.type}/${ref.id}`));
            alreadyDependsOnGrants = some(data, ref => ref.type === 'grants');
          } else {
            alreadyDependsOnGrants = data.type === 'grants';
            dependsOn.push(`${data.type}/${data.id}`);
          }
        });
      }

      // There is an implicit relationship between grants and pretty much every other record.
      // This is a short term fix to deal with this situation. Ultimately we want to invalidate everybody's
      // realms everytime grants change. Need to be careful not to create circular relationships, so not
      // adding grant dependencies to bootstrap schema or to instances of types that grants are depending on.
      if (!alreadyDependsOnGrants &&
          !['data-sources','content-types','fields','grants','default-values','groups'].includes(model.type)) {
        for (let grant of grants) {
          if (grant.relationships) {
            for (let rel of Object.keys(grant.relationships)) {
              let data = grant.relationships[rel].data;
              if (Array.isArray(data) && !some(data, ref => ref.type === model.type)) {
                dependsOn.push(`${grant.type}/${grant.id}`);
              } else if (!Array.isArray(data) && (model.type !== data.type)) {
                dependsOn.push(`${grant.type}/${grant.id}`);
              } else { break; }
            }
          } else {
            dependsOn.push(`${grant.type}/${grant.id}`);
          }
        }
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
    });
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
  asDocument() {
    return { data: this.data };
  }
}

function dasherize(camelCase) {
  return camelCase.replace(/([a-z])([A-Z])/g, (a,b,c) => `${b}-${c.toLowerCase()}`);
}
