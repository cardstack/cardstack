import { capitalize } from '@ember/string';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-mode-choices';

export default Component.extend({
  layout,
  tagName: '',
  tools: service('cardstack-tools'),

  optionsKey: computed('for', function() {
    return this.get('for') + 'Choices';
  }),

  actions: {
    activate(modeId) {
      this.get('tools')[`set${capitalize(this.get('for'))}`](modeId);
    }
  }

});
