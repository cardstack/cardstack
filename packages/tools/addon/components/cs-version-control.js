import Ember from 'ember';
import layout from '../templates/components/cs-version-control';

export default Ember.Component.extend({
  layout,
  tagName: '',
  opened: true,
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
