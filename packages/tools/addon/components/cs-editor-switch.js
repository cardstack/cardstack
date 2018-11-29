import Component from '@ember/component';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import layout from '../templates/components/cs-editor-switch';

export default Component.extend({
  layout,
  tagName: '',
  tools: service('cardstack-tools'),
  enabled: alias('tools.editing'),
  actions: {
    toggleEditing() {
      this.get('tools').setEditing(!this.get('enabled'));

      if (!this.get('enabled')) {
        this.get('tools').openField();
      }
    }
  }
});
