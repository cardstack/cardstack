import Component from '@ember/component';
import layout from '../../templates/components/field-editors/integer-editor';

export default Component.extend({
  layout,
  onchange() {},

  actions: {
    update(value) {
      let content = this.get('content');
      let field = this.get('field');
      if (!value) {
        content.set(field, null);
      } else {
        content.set(field, Number(value));
      }
    }
  }
});
