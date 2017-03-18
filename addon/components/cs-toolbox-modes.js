import Ember from 'ember';
import layout from '../templates/components/cs-toolbox-modes';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),

  control: 'activePanel',
  optionsKey: Ember.computed('control', function() {
    return this.get('control') + 'Choices';
  }),

  actions: {
    activate(modeId) {
      this.get('tools')[`set${Ember.String.capitalize(this.get('control'))}`](modeId);
    }
  }

});
