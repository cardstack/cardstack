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
  errors: null,

  init() {
    this._super(...arguments);
    if (!this.onchange) {
      this.onchange = () => {};
    }
  },

  disabled: not('enabled'),

  firstError: computed('errors.[]', function() {
    return this.errors && this.errors[0];
  })
});
