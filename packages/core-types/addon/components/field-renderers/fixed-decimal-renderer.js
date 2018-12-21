import Component from '@ember/component';
import layout from '../../templates/components/field-renderers/fixed-decimal-renderer';
import { computed } from '@ember/object';

export default Component.extend({
  layout,
  tagName: '',

  fixedValue: computed('value', function() {
    let value = this.get('value');

    if (typeof value === 'number') {
      if (value === Math.round(value)) {
        return Math.round(value); // display "5", not "5.0"
      } else if (value * 10 === value.toFixed(1) * 10) {
        return value.toFixed(1); // display "5.4", not "5.40"
      } else {
        return value.toFixed(2); // everything else, round to 2 significant digits
      }
    }
  })
});
