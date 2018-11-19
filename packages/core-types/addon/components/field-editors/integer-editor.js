import Component from '@ember/component';
import layout from '../../templates/components/field-editors/integer-editor';

export default Component.extend({
  layout,

  actions: {
    update(value) {
      let content = this.get('content');
      let field = this.get('field');
      if (value == null || value === '') {
        content.set(field, null);
      } else {
        content.set(field, +value);
      }
    }
  }
});
