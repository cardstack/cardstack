import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-editor-switch';

export default Component.extend({
  layout,
  classNames: ['cs-editor-switch'],
  tools: service('cardstack-tools'),
  actions: {
    setEditing(value) {
      this.get('tools').setEditing(value);
      if (!value) {
        this.get('tools').openField();
      }
    }
  }
});
