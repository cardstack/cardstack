import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-version-control';
import { task } from 'ember-concurrency';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { computed } from "@ember/object";
import { or } from '@ember/object/computed';

export default Component.extend({
  layout,
  tagName: '',
  opened: true,
  animationRules,
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

  disabled: computed.equal('modificationState', 'saved'),

  currentState: computed('modificationState', 'upstreamState', function() {
    let modificationState = this.get('modificationState');
    let upstreamState = this.get('upstreamState');

    switch (modificationState) {
      case 'new':
        return 'draft'
      case 'changed':
        return 'edited';
      case 'saved':
        if (upstreamState === 'self') return 'published';
        else return 'saved';
      default:
        return;
    }
  }),

  // hasDirtyFields comes from the ember-data-relationship-tracker
  // addon, if it's available. It's fine if it's not since the value
  // will default to false, you just don't get relationship dirty tracking
  anythingDirty: or('model.{hasDirtyFields,hasDirtyOwned}'),

  anythingPending: or('model.isNew', 'anythingDirty'),

  update: task(function * () {
    let model = this.get('model');
    let errors = yield this.get('data').validate(model);
    if (Object.keys(errors).length > 0) {
      return this['on-error'](errors);
    }
    yield model.save();
  }).keepLatest(),

  cancel: task(function * () {
    if (this.get('anythingDirty')) {
      let model = this.get('model');
      let upstreamModel = yield this.get('store').findRecord(model.type, model.id);
      upstreamModel.rollbackAttributes();
      upstreamModel.rollbackRelationships();
    }
    this.get('tools').setEditing(false);
  }),

  delete: task(function * () {
    yield this.get('model').destroyRecord();

    this.get('router').transitionTo('application');
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
