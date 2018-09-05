import DS from 'ember-data';
import RelationshipTracker from "ember-data-relationship-tracker";
import { inject as service } from '@ember/service';
import { computed, defineProperty } from '@ember/object';
import { readOnly, or } from '@ember/object/computed';
import { capitalize } from '@ember/string';

export default DS.Model.extend(RelationshipTracker, {
  resourceMetadata: service(),

  init() {
    this._super();
    let relationMap = this.constructor.relationshipsByName;
    let dirtyTrackingProperties = [];
    relationMap.forEach((relation) => {
      let { kind, meta } = relation;
      let { owned } = meta.options;
      if (owned) {
        let propertyName = createHasDirtyForRelationship(this, meta.name, kind);
        dirtyTrackingProperties.push(propertyName);
      }
    });
    if (dirtyTrackingProperties.length > 0) {
      createHasDirtyOwned(this, dirtyTrackingProperties);
    }
  },

  version: computed(function() {
    let meta = this.get('resourceMetadata').read(this);
    return meta && meta.version;
  }),

  async save() {
    // this._super is not safe to use asynchronously
    // see https://github.com/ember-cli/ember-cli/issues/6282
    let modelSave = this._super.bind(this);
    await this.saveRelated();
    await modelSave();
  },

  async saveRelated() {
    let relationshipsByName = this.constructor.relationshipsByName;
    let relatedSaves = this.dirtyRelationships.map(field => {
      let { kind } = relationshipsByName.get(field);
      let relatedRecords = kind === 'hasMany' ? this[field] : [ this.field ];
      let dirtyRecords = relatedRecords.filter(record => record.hasDirtyFields);
      return dirtyRecords.invoke('save');
    });
    return Promise.all(flatten(relatedSaves));
  },
});

function createHasDirtyForRelationship(model, name, kind) {
  let propertyName = `hasDirty${capitalize(name)}`;
  if (kind === 'hasMany') {
    defineProperty(model, propertyName, computed(`${name}.@each.hasDirtyAttributes`, function() {
      return model.get(name).toArray().some((related) => related.hasDirtyAttributes);
    }));
  } else {
    defineProperty(model, propertyName, readOnly(`${name}.hasDirtyAttributes`));
  }
  return propertyName;
}

function createHasDirtyOwned(model, properties) {
  defineProperty(model, 'hasDirtyOwned', or(properties.join(',')));
}

function flatten(arrays) {
  return arrays.reduce((flattened, array) => {
    return flattened.concat(array);
  }, []);
}
