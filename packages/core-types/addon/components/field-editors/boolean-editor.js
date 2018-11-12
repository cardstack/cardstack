import { get, set } from '@ember/object';
import Component from '@ember/component';
import layout from '../../templates/components/field-editors/boolean-editor';

export default Component.extend({
  layout,

  actions: {
    toggleValue(value) {
      let content = get(this, 'content');
      let field = get(this, 'field');

      set(content, field, value);
      let onchange = this.get('onchange');
      if (onchange) {
        onchange();
      }
    },
  },
});
