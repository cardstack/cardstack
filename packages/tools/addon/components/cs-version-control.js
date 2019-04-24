import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-version-control';
import { task } from 'ember-concurrency';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { computed } from "@ember/object";
import { or, equal } from '@ember/object/computed';

export default Component.extend({
  layout,
  tagName: '',
  "on-error": function() {},
  resourceMetadata: service(),
  store: service(),
  router: service(),
  data: service('cardstack-data'),
  tools: service('cardstack-tools'),

  modelMeta: computed('model', function() {
    return this.get('resourceMetadata').read(this.get('model'));
  }),

  modelType: computed('model', function() {
    return modelType(this.get('model'));
  }),

  fetchPermissionsFor: task(function * (record) {
    return yield this.get('data').fetchPermissionsFor(record);
  }),

  modificationState: computed('model.isNew', 'anythingDirty', function() {
    if (this.get('model.isNew')) {
      return "new";
    } else if (this.get('anythingDirty')) {
      return "editing";
    } else {
      return "saved";
    }
  }),

  disabled: equal('modificationState', 'saved'),

  // hasDirtyFields comes from the ember-data-relationship-tracker
  // addon, if it's available. It's fine if it's not since the value
  // will default to false, you just don't get relationship dirty tracking
  anythingDirty: or('model.{hasDirtyFields,hasDirtyOwned}'),

  anythingPending: or('model.isNew', 'anythingDirty'),

  update: task(function * () {
    let model = this.get('model');
    let afterModelSaved = this.get('afterModelSaved');
    let errors = yield this.get('data').validate(model);
    if (Object.keys(errors).length > 0) {
      return this['on-error'](errors);
    }
    yield model.save();

    if (typeof afterModelSaved === 'function') {
      afterModelSaved(model);
    }
  }).keepLatest(),

  cancel: task(function * () {
    this.get('tools').setEditing(false);
    this.get('tools').setActive(false);

    let model = this.get('model');
    if (model.id && typeof model.cardstackRollback === 'function' && this.get('anythingDirty')) {
      yield model.cardstackRollback();
    }
  }),

  delete: task(function * () {
    yield this.get('model').destroyRecord();

    this.get('router').transitionTo('application');
  }),
});
