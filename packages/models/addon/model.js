import DS from 'ember-data';
import RelationshipTracker from "ember-data-relationship-tracker";
import { inject as service } from '@ember/service';
import { computed } from '@ember/object';

export default DS.Model.extend(RelationshipTracker, {
  resourceMetadata: service(),

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

function flatten(arrays) {
  return arrays.reduce((flattened, array) => {
    return flattened.concat(array);
  }, []);
}
