import Ember from 'ember';
import layout from '../templates/components/cs-create-button';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),
  actions: {
    create() {
      this.get('tools').setActivePanel('cs-create-menu');
    }
  }
});
