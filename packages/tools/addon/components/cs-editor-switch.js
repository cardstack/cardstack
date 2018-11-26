import Component from '@ember/component';
import layout from '../templates/components/cs-editor-switch';

export default Component.extend({
  layout,
  tagName: '',
  actions: {
    setEditing(value) {
      this.get('tools').setEditing(value);
      if (!value) {
        this.get('tools').openField();
      }
    },
    toggleEditing() {
      this.get('tools').setEditing(!this.get('enabled'));
    }
  }
});
