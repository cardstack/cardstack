import Ember from 'ember';
import layout from '../templates/components/cs-version-control';
import { task } from 'ember-concurrency';
import { transitionTo } from '../private-api';

export default Ember.Component.extend({
  layout,
  tagName: '',
  opened: true,
  resourceMetadata: Ember.inject.service(),
  store: Ember.inject.service(),
  cardstackRouting: Ember.inject.service(),

  modelMeta: Ember.computed('model', function() {
    return this.get('resourceMetadata').read(this.get('model'));
  }),

  onMaster: Ember.computed('modelMeta.branch', function() {
    return this.get('modelMeta').branch === this.get('cardstackRouting.defaultBranch');
  }),

  upstreamMeta: Ember.computed('upstreamModel', function() {
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

  // this describes the state of our model relative to its branch. So
  // "saved" here means it has been saved to its branch, etc.
  modificationState: Ember.computed('model.isNew', 'model.hasDirtyFields', function() {
    if (this.get('model.isNew')) {
      return "new";
    } else  if (this.get('model.hasDirtyFields')) {
      return "changed";
    } else {
      return "saved";
    }
  }),

  // this describes the state of our model relative to its value on
  // the default branch.
  upstreamState: Ember.computed('upstreamMeta.hash', 'modelMeta.hash', 'onMaster', 'fetchUpstreamModel.isRunning', function() {
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

  titleClass: Ember.computed('upstreamState', function() {
    let state = this.get('upstreamState');
    if (state === 'created' || state === 'different') {
      return 'cs-version-control-preview';
    }
  }),

  title: Ember.computed('modificationState', 'upstreamState', function() {
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

  anythingPending: Ember.computed('model.isNew', 'model.hasDirtyFields', function() {
    return this.get('model.isNew') || this.get('model.hasDirtyFields');
  }),

  update: task(function * () {
    let model = this.get('model');
    let creating = model.get('isNew');
    yield model.save();
    if (creating && model.get('slug')) {
      let { name, args, queryParams } = this.get('cardstackRouting').routeFor(model.get('type'), model.get('slug'), this.get('modelMeta.branch'));
      yield transitionTo(Ember.getOwner(this), name, args, queryParams);
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
