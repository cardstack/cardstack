import Ember from 'ember';
import layout from '../templates/components/cs-toolbox-modes';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),
  currentMode: Ember.computed.alias('tools.activePanel'),
  options: Ember.computed.alias('tools.activePanelChoices'),

  modes: Ember.computed('currentMode', function() {
    let current = this.get('currentMode');
    return this.get('options').map(entry => ({
      id: entry.id,
      active: entry.id === current,
      makeActive: () => this.get('tools').setActivePanel(entry.id),
      icon: entry.icon
    }));
  })
});
