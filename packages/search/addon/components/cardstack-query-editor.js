import Ember from 'ember';
import layout from '../templates/components/cardstack-query-editor';

export default Ember.Component.extend({
  layout,
  internalQuery: Ember.computed('query', function() {
    return this.get('query') || {};
  }),
  actions: {
    update() {
      this.sendAction("update", Ember.assign({}, this.get("internalQuery")));
    }
  }
});
