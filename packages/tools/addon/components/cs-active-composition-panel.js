import Component from '@ember/component';
import layout from '../templates/components/cs-active-composition-panel';
import { task, timeout } from 'ember-concurrency';
import scrollToBounds from '../scroll-to-bounds';
import { inject as service } from '@ember/service';
import { camelize } from '@ember/string';

export default Component.extend({
  layout,
  classNames: ['cs-active-composition-panel'],

  validationErrors: null,
  permissions: null,

  data: service('cardstack-data'),

  willInsertElement() {
    this._super(...arguments);
    this.get('fetchPermissions').perform();
  },

  fetchPermissions: task(function * () {
    let records = [this.model, ...this.model.relatedOwnedRecords()];
    let permissionTuples = yield Promise.all(records.map(async (record) => {
      let permissions = await this.get('data').fetchPermissionsFor(record);
      return [record, permissions];
    }));
    let permissions = permissionTuples.reduce((hash, permissions) => {
      let [ record, permissionsForRecord ] = permissions;
      let key = this.get('data').getCardMeta(record, 'uid');
      hash[key] = permissionsForRecord;
      return hash;
    }, {});
    this.set('permissions', permissions);
  }),

  validateTask: task(function * () {
    let errors = yield this.get('data').validate(this.model);
    let errorsForFieldNames = {};
    for (let key in errors) {
      errorsForFieldNames[camelize(key)] = errors[key];
    }
    this.set('validationErrors', errorsForFieldNames);
  }),

  highlightAndScrollToField: task(function * (field) {
    this.get('highlightField')(field);
    if (field) {
      yield timeout(500);
      scrollToBounds(field.bounds());
    }
  }).restartable(),

  actions: {
    validate() {
      return this.get('validateTask').perform();
    }
  }
});
