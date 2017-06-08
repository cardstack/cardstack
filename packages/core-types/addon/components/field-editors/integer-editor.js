import Ember from 'ember';
import layout from '../../templates/components/field-editors/integer-editor';

export default Ember.Component.extend({
  layout,
  invalid: false,
  refresh: 1,
  actions: {
    update(value) {
      let content = this.get('content');
      let field = this.get('field');
      if (value == null || value === '') {
        content.set(field, null);
        this.set('invalid', false);
      } else {
        value = String(value).trim();
        if (/^\d+$/.test(value)) {
          let number = parseFloat(value);
          if (number >= 0) {
            number = parseFloat(number.toFixed(2));
            content.set(field, number);
            this.set('invalid', false);
            return;
          }
        }
        this.set('invalid', true);
      }
    },
    normalize() {
      // TODO
    }
  }
});
