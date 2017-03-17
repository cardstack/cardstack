import Ember from 'ember';
import layout from '../templates/components/cs-view-mode-buttons';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),
  currentMode: Ember.computed.alias('tools.viewMode'),

  actions: {
    setMode(which) {
      this.get('tools').setViewMode(which);
    }
  },

  modes: [ 'page', 'cards' ]
});
