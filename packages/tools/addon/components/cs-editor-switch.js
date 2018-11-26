import Component from '@ember/component';
import layout from '../templates/components/cs-editor-switch';

export default Component.extend({
  layout,
  tagName: '',
  actions: {
    setEditing(value) {
      this.get('tools').setEditing(value);
    },
    toggleEditing() {
      this.get('tools').setEditing(!this.get('enabled'));
    }
  }
});
