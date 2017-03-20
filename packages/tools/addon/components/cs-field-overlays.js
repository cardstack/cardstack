import Ember from 'ember';
import layout from '../templates/components/cs-field-overlays';

export default Ember.Component.extend({
  layout,
  classNames: ['cardstack-tools'],
  tools: Ember.inject.service('cardstack-tools'),
  actions: {
    openField(which) {
      this.get('tools').openField(which);
    }
  }
});
