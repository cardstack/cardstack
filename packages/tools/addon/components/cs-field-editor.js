import Component from '@ember/component';
import { computed } from '@ember/object';
import layout from '../templates/components/cs-field-editor';

export default Component.extend({
  layout,
  classNames: ['cs-field-editor'],

  // @args
  content: null,
  field: '',
  enabled: true,
  errors: null,
  permissions: null,
  onchange() {},

  canUpdate: computed('permissions', function() {
    if (!this.permissions) {
      return false;
    }
    let { mayUpdateResource, writableFields } = this.permissions;
    return mayUpdateResource && writableFields.includes(this.field);
  }),

  disabled: computed('enabled', 'canUpdate', function() {
    return !(this.enabled && this.canUpdate);
  }),

  firstError: computed('errors.[]', function() {
    return this.errors && this.errors[0];
  })
});
