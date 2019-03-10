import Component from '@ember/component';
import layout from '../templates/components/cs-active-composition-panel';
import { task, timeout } from 'ember-concurrency';
import scrollToBounds from '../scroll-to-bounds';
import { inject as service } from '@ember/service';
import { camelize } from '@ember/string';
import { urlForModel } from '@cardstack/routing/helpers/cardstack-url';

export default Component.extend({
  layout,
  classNames: ['cs-active-composition-panel'],

  validationErrors: null,
  permissions: null,

  data: service('cardstack-data'),
  router: service(),
  cardstackRouting: service(), // this is used in the `urlForModel` helper (since it has no container)

  didReceiveAttrs() {
    this._super(...arguments);
    this._fetchPermissionsIfModelChanged.perform();
  },

  didUpdateAttrs() {
    this._super(...arguments);
    this._fetchPermissionsIfModelChanged.perform();
  },

  _fetchPermissionsIfModelChanged: task(function * () {
    if (this.previousModel !== this.model) {
      yield this.get('fetchPermissions').perform();
      this.set('previousModel', this.model);
    }
  }),

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
  }).restartable(),

  fetchPermissionsFor: task(function * (record) {
    return yield this.get('data').fetchPermissionsFor(record);
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

  afterModelSaved(model, branch) {
    let location = this.get('router.location');
    let url = urlForModel(this, model, { branch });
    location.setURL(url);
  },

  actions: {
    validate() {
      return this.get('validateTask').perform();
    }
  }
});
