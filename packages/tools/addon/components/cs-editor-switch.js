import Ember from 'ember';
import layout from '../templates/components/cs-editor-switch';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-editor-switch'],
  tools: Ember.inject.service('cardstack-tools'),
  actions: {
    setEditing(value) {
      this.get('tools').setEditing(value);
    }
  }
});
