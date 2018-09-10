import layout from '../../templates/components/cs-field-alternatives/alternative';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { assert } from '@ember/debug';

const LIMIT = 7;

export default Component.extend({
  layout,
  tagName: '',

  fieldNames: computed('fields', function() {
    let fields = this.get('fields');
    if (!Array.isArray(fields)) {
      fields = fields.split(/\s*,\s*/g);
    }
    if (fields.length > LIMIT) {
      throw new Error(`can't handle more than ${LIMIT} fields in a group at the moment, see cs-field-group's template`);
    }
    return fields;
  }),

  init() {
    this._super(...arguments);
    assert('Alternative name must be provided', !!this.get('name'));
    assert('Alternative fieldNames must be provided', !!this.get('fieldNames'));

    this.get('registerAlternative')({
      name: this.get('name'),
      fieldNames: this.get('fieldNames')
    });
  }

});
