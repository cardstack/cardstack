import Ember from 'ember';
import layout from '../templates/components/cs-version-control';
import { task } from 'ember-concurrency';

export default Ember.Component.extend({
  layout,
  tagName: '',
  opened: true,
  resourceMetadata: Ember.inject.service(),
  store: Ember.inject.service(),

  defaultBranch: Ember.computed(function() {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    return config.cardstack.defaultBranch;
  }),

  modelMeta: Ember.computed('model', function() {
    return this.get('resourceMetadata').read(this.get('model'));
  }),

  onMaster: Ember.computed('modelMeta', function() {
    return this.get('modelMeta').branch === this.get('defaultBranch');
  }),

  fetchUpstreamModel: task(function * () {
    this.set('upstreamModel', null);
    let meta = this.get('modelMeta');
    if (meta.branch === this.get('defaultBranch')) {
      // Nothing to do, we're already the master version
      return;
    }
    let model = this.get('model');
    let type = model.constructor.modelName;
    let id = model.get('id');
    if (id == null) {
      // Nothing to do, we don't have an id yet. It's vanishingly
      // unlikely that we're about to collide with something on
      // upstream anyway.
      return;
    }
    try {
      let upstreamModel = yield this.get('store').findRecord('cardstack-generic', `master/${type}/${id}`);
      this.set('upstreamModel', upstreamModel);
    } catch (err) {
      if (err.isAdapterError && err.errors && err.errors.length > 0 && err.errors[0].code === 404) {
        // There's no upstream model, that's OK.
        return;
      }
      throw err;
    }
  }).observes('modelMeta.branch', 'model.id').on('init'),

  title: Ember.computed('model.isNew', 'model.hasDirtyFields', function() {
    if (this.get('model.isNew')) {
      return "Unsaved";
    }
    if (this.get('model.hasDirtyFields')) {
      return "Changed";
    } else {
      return "Saved";
    }
  }),

  anythingPending: Ember.computed('model.isNew', 'model.hasDirtyFields', function() {
    return this.get('model.isNew') || this.get('model.hasDirtyFields');
  }),


  actions: {
    open() {
      this.set('opened', true);
    },
    close() {
      this.set('opened', false);
    },
    update() {
      this.get('model').save();
    }
  }
});
