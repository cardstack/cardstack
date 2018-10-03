import { not } from '@ember/object/computed';
import Component from '@ember/component';
import { computed } from '@ember/object';
import layout from '../../templates/components/field-editors/string-editor';

export default Component.extend({
  layout,
  disabled: not('enabled'),

  isContentInvalid: not('content.isValid'),

  hasValidationError: computed('isContentInvalid', function() {
    return this.content.errors.has(this.field);
  }),

  firstValidationError: computed('hasValidationError', function() {
    if (this.hasValidationError) {
      let errorsForField = this.content.errors.errorsFor(this.field);
      return errorsForField.firstObject.message;
    }
  }),
});
