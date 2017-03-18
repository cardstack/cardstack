import Ember from 'ember';
import layout from '../templates/components/cs-toolbox-modes';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),
  currentMode: Ember.computed.alias('tools.activePanel'),

  actions: {
    setMode(which) {
      this.get('tools').setActivePanel(which);
    }
  },

  modes: [
    'cardstack-toolbox',
    'cardstack-library'
  ]
});
