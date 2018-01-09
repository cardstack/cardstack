import Ember from 'ember';
import layout from '../templates/components/cs-version-control';
import { task } from 'ember-concurrency';
import { transitionTo } from '../private-api';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { computed } from "@ember/object";

export default Ember.Component.extend({
  layout,
  tagName: '',
  opened: true,
  animationRules,
  resourceMetadata: Ember.inject.service(),
  store: Ember.inject.service(),

  modelMeta: computed('model', function() {
    return this.get('resourceMetadata').read(this.get('model'));
  }),

  modelType: computed('model', function() {
    return modelType(this.get('model'));
  }),

  onMaster: computed('modelMeta.branch', function() {
    let branch = this.get('modelMeta').branch;
    return branch == null || branch === defaultBranch;
  }),

  upstreamMeta: computed('upstreamModel', function() {
    let upstream = this.get('upstreamModel');
    if (upstream) {
      return this.get('resourceMetadata').read(upstream);
    }
  }),

  fetchUpstreamModel: task(function * () {
    this.set('upstreamModel', null);
    if (this.get('onMaster')) {
      // Nothing to do, we're already on the default branch, so there
      // is no model more upstream than ours.
      return;
    }
    let model = this.get('model');
    let type = modelType(model);
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

  // this describes the state of our model relative to its branch. So
  // "saved" here means it has been saved to its branch, etc.
  modificationState: computed('model.isNew', 'anythingDirty', function() {
    if (this.get('model.isNew')) {
      return "new";
    } else  if (this.get('anythingDirty')) {
      return "changed";
    } else {
      return "saved";
    }
  }),

  // this describes the state of our model relative to its value on
  // the default branch.
  upstreamState: computed('upstreamMeta.hash', 'modelMeta.hash', 'onMaster', 'fetchUpstreamModel.isRunning', function() {
    if (this.get('onMaster')) {
      return 'self';
    }

    if (this.get('fetchUpstreamModel.isRunning')) {
      return 'pending';
    }

    let upstreamMeta = this.get('upstreamMeta');
    if (!upstreamMeta) {
      return 'created';
    }

    let meta = this.get('modelMeta');
    if (meta.hash === upstreamMeta.hash) {
      return 'same';
    } else {
      return 'different';
    }

  }),

  titleClass: computed('upstreamState', function() {
    let state = this.get('upstreamState');
    if (state === 'created' || state === 'different') {
      return 'cs-version-control-preview';
    }
  }),

  title: computed('modificationState', 'upstreamState', function() {
    switch(this.get('modificationState')) {
    case 'new':
      return 'Drafted'
    case 'changed':
      return 'Changed';
    case 'saved':
      switch(this.get('upstreamState')) {
      case 'pending':
        return '...';
      case 'self':
        return 'Live';
      case 'created':
      case 'different':
      case 'same':
        return 'Preview';
      }
    }
  }),

  anythingDirty: computed('model.hasDirtyFields', 'model.hasDirtyAttributes', function() {
    // hasDirtyFields comes from the ember-data-relationship-tracker
    // addon, if it's available. It's fine if it's not since the value
    // will default to false, you just don't get relationship dirty
    // tracking
    return this.get('model.hasDirtyFields') || this.get('model.hasDirtyAttributes');
  }),

  anythingPending: computed('model.isNew', 'anythingDirty', function() {
    return this.get('model.isNew') || this.get('anythingDirty');
  }),

  update: task(function * () {
    yield this.get('model').save();
  }).keepLatest(),

  delete: task(function * () {
    let model = this.get('model');
    let placeholder = { isCardstackPlaceholder: true, type: modelType(model), slug: model.get('slug') };
    if (model.get('isNew')) {
      transitionTo(Ember.getOwner(this), 'cardstack.new-content', [placeholder]);
      return;
    }
    let branch = this.get('modelMeta.branch');
    this.get('resourceMetadata').write(placeholder, { branch });
    let route = this.get('cardstackRouting').routeFor(modelType(model), model.get('slug'), branch);
    yield this.get('model').destroyRecord();
    if (route) {
      transitionTo(Ember.getOwner(this), route.name, [placeholder], route.queryParams);
    }
  }),

  actions: {
    open() {
      this.set('opened', true);
    },
    close() {
      this.set('opened', false);
    }
  }
});

function animationRules() {
  this.transition(
    this.fromValue(false),
    this.toValue(true),
    this.use('to-down', { duration: 250 }),
    this.reverse('to-up', { duration: 250 })
  );
}
