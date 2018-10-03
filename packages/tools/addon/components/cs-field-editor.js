import Component from '@ember/component';
import { not } from '@ember/object/computed';
import { computed } from '@ember/object';
import layout from '../templates/components/cs-field-editor';

export default Component.extend({
  layout,
  tagName: '',

  // @args
  content: null,
  field: '',
  enabled: true,

  disabled: not('enabled'),

  isContentInvalid: not('content.isValid'),

  hasValidationError: computed('isContentInvalid', 'content.errors', function() {
    if (this.isContentInvalid) {
      return this.content.errors.has(this.field);
    }
  }),

  firstValidationError: computed('hasValidationError', function() {
    if (this.hasValidationError) {
      let errorsForField = this.content.errors.errorsFor(this.field);
      return errorsForField.firstObject.message;
    }
  }),
});
