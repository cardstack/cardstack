import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-editor-switch';

export default Component.extend({
  layout,
  classNames: ['cs-editor-switch'],
  tools: service('cardstack-tools'),
  enabled: alias('tools.editing'),
  actions: {
    setEditing(value) {
      this.get('tools').setEditing(value);
    },
    toggleEditing() {
      this.get('tools').setEditing(!this.get('enabled'));
    }
  }
});
