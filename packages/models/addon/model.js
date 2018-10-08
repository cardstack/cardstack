import DS from 'ember-data';
import RelationshipTracker from "ember-data-relationship-tracker";
import { inject as service } from '@ember/service';
import { computed, defineProperty, get } from '@ember/object';
import { readOnly, or } from '@ember/object/computed';
import { capitalize } from '@ember/string';
import { run } from '@ember/runloop';

export default DS.Model.extend(RelationshipTracker, {
  resourceMetadata: service(),

  init() {
    this._super();
    let dirtyTrackingProperties = {};
    this._relationshipsByName().forEach((relation) => {
      let { kind, meta } = relation;
      if (meta) {
        let { owned } = meta.options;
        if (owned) {
          let propertyName = createHasDirtyForRelationship(this, meta.name, kind);
          dirtyTrackingProperties[meta.name] = propertyName;
        }
      }
    });
    if (Object.keys(dirtyTrackingProperties).length > 0) {
      createHasDirtyOwned(this, Object.values(dirtyTrackingProperties));
    }
    this.set('dirtyTrackingRelationNames', dirtyTrackingProperties);
  },

  relationshipTrackerVersion: computed(function() {
    let meta = this.get('resourceMetadata').read(this);
    return meta && meta.version;
  }),

  async save() {
    // this._super is not safe to use asynchronously
    // see https://github.com/ember-cli/ember-cli/issues/6282
    let modelSave = this._super.bind(this);
    run(async () => {
      await this.saveRelated();
    });
    await modelSave(...arguments);
  },

  async saveRelated() {
    let relatedSaves = Object.keys(this.dirtyTrackingRelationNames).map((relationName) => {
      let isRelationDirty = this.dirtyTrackingRelationNames[relationName];
      if (isRelationDirty) {
        let { kind } = this._relationshipsByName().get(relationName);
        let related = this.get(relationName);
        let relatedRecords = kind === 'hasMany' ? related : [ this.related ];
        let dirtyRecords = relatedRecords.filter(record => record.hasDirtyFields);
        return dirtyRecords.invoke('save');
      }
    });
    return Promise.all(flatten(relatedSaves));
  },

  _relationshipsByName() {
    return get(this.constructor, 'relationshipsByName');
  }
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
