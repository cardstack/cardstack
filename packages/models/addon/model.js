import DS from 'ember-data';
import RelationshipTracker from "ember-data-relationship-tracker";
import { inject as service } from '@ember/service';
import { computed, defineProperty, get } from '@ember/object';
import { readOnly, or } from '@ember/object/computed';
import { capitalize } from '@ember/string';
import { uniq } from 'lodash';

export default DS.Model.extend(RelationshipTracker, {
  resourceMetadata: service(),

  init() {
    this._super();
    let ownedRelationships = {};
    this._relationshipsByName().forEach((relation) => {
      let { kind, meta } = relation;
      if (meta) {
        let { owned } = meta.options;
        if (owned) {
          ownedRelationships[meta.name] = kind;
        }
      }
    });

    if (Object.keys(ownedRelationships).length > 0) {
      this._createDirtyTrackingCPs(ownedRelationships);
    }
    this.set('ownedRelationships', ownedRelationships);
  },

  relationshipTrackerVersion: computed(function() {
    let meta = this.get('resourceMetadata').read(this);
    return meta && meta.version;
  }),

  async save() {
    // this._super is not safe to use asynchronously
    // see https://github.com/ember-cli/ember-cli/issues/6282
    let modelSave = this._super.bind(this);

    if (Object.keys(this.ownedRelationships).length > 0) {
      await this.saveRelated(...arguments);
    }

    await modelSave(...arguments);
  },

  async saveRelated() {
    let relatedSaves = Object.keys(this.ownedRelationships).map(async (relationName) => {
      let isRelationDirty = this.dirtyTrackingRelationNames[relationName];
      if (isRelationDirty) {
        let relatedRecords = relatedRecordsFor(this, relationName);
        let dirtyRecords = relatedRecords.filter(record => record.hasDirtyFields);
        return Promise.all(dirtyRecords.map(record => record.save(...arguments)));
      }
    });
    return Promise.all(flatten(relatedSaves));
  },

  relatedOwnedRecords() {
    return uniq(relatedOwnedRecords([ this ]));
  },

  cardstackRollback() {
    this.rollbackAttributes();
    this.rollbackRelationships();
    this.reload(); // this is to rollback attributes that are arrays

    if (this.dirtyTrackingRelationNames) {
      let relationNames = Object.keys(this.dirtyTrackingRelationNames);
      relationNames.forEach(relation => {
        let relationItems = this.get(relation);
        relationItems.forEach(item => {
          item.rollbackAttributes();
          item.rollbackRelationships();
        });
      });
    }
  },

  _createDirtyTrackingCPs(ownedRelationships) {
    let dirtyTrackingProperties = {};
    for (let relationshipName in ownedRelationships) {
      let kind = ownedRelationships[relationshipName];
      let propertyName = createHasDirtyForRelationship(this, relationshipName, kind);
      dirtyTrackingProperties[relationshipName] = propertyName;
    }
    createHasDirtyOwned(this, ownedRelationships, Object.values(dirtyTrackingProperties));
    this.set('dirtyTrackingRelationNames', dirtyTrackingProperties);
  },

  _relationshipsByName() {
    return get(this.constructor, 'relationshipsByName');
  }
});

function relatedOwnedRecords(models, records=[]) {
  if (models.length === 0) {
    return records;
  }
  let [ model, ...remainingModels ] = models;
  Object.keys(model.ownedRelationships).map((relationName) => {
    let relatedRecords = relatedRecordsFor(model, relationName);
    records = records.concat(relatedRecords);
    remainingModels = remainingModels.concat(relatedRecords);
  });
  return relatedOwnedRecords(remainingModels, records);
}

function relatedRecordsFor(model, relationName) {
  let kind = model.ownedRelationships[relationName];
  let related = model.get(relationName);
  return (kind === 'hasMany' ? related.toArray() : [ related ]).filter(Boolean);
}

function createHasDirtyForRelationship(model, name, kind) {
  let propertyName = `hasDirty${capitalize(name)}`;
  if (kind === 'hasMany') {
    defineProperty(model, propertyName, computed(`${name}.@each.hasDirtyFields`, function() {
      return model.get(name).toArray().some((related) => related.hasDirtyFields);
    }));
  } else {
    defineProperty(model, propertyName, readOnly(`${name}.hasDirtyFields`));
  }
  return propertyName;
}

function createHasDirtyOwned(model, ownedRelationships, properties) {
  defineProperty(model, 'hasDirtyOwnedRelationships', or(...properties));

  let dependentKeys = Object.keys(ownedRelationships).reduce((dependentKeys, relationName) => {
    let kind = ownedRelationships[relationName];
    if (kind === 'belongsTo') {
      dependentKeys.push(`'${relationName}.hasDirtyOwned'`);
    } else {
      dependentKeys.push(`'${relationName}.@each.hasDirtyOwned'`);
    }
    return dependentKeys;
  }, []);

  defineProperty(model, 'hasDirtyOwned', computed('hasDirtyOwnedRelationships', ...dependentKeys, function() {
    if (model.hasDirtyOwnedRelationships) {
      return true;
    }
    return Object.keys(ownedRelationships).some((relationName) => {
      let relatedRecords = relatedRecordsFor(model, relationName);
      return relatedRecords.some((records) => records.hasDirtyOwned);
    });
  }));
}

function flatten(arrays) {
  return arrays.reduce((flattened, array) => {
    return flattened.concat(array);
  }, []);
}
