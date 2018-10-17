import Component from '@ember/component';
import { not } from '@ember/object/computed';
import { computed } from '@ember/object';
import { task } from 'ember-concurrency';
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
    if (this.get('isContentInvalid')) {
      return this.content.get('errors').has(this.field);
    }
  }),

  firstValidationError: computed('hasValidationError', function() {
    if (this.hasValidationError) {
      let errorsForField = this.content.get('errors').errorsFor(this.field);
      return errorsForField.get('firstObject.message');
    }
  }),

  validate: task(function * () {
    yield this.content.validate();
  })
});
