import Ember from 'ember';
import layout from '../templates/components/cs-mode-choices';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),

  optionsKey: Ember.computed('for', function() {
    return this.get('for') + 'Choices';
  }),

  actions: {
    activate(modeId) {
      this.get('tools')[`set${Ember.String.capitalize(this.get('for'))}`](modeId);
    }
  }

});
