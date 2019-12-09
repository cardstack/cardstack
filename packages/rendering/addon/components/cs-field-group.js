import layout from '../templates/components/cs-field-group';
import { humanize } from '../helpers/cs-humanize';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { guidFor } from '@ember/object/internals';

const limit = 7;

export default Component.extend({
  layout,
  tagName: '',

  id: computed('content', 'name', function() {
    return `${guidFor(this.get('content'))}/cs-field-group/${this.get('name')}`;
  }),

  groupCaption: computed('caption', 'name', function() {
    return this.get('caption') || humanize(this.get('name'));
  }),

  fieldNames: computed('fields', function() {
    let fields = this.get('fields');
    if (!Array.isArray(fields)) {
      fields = fields.split(/\s*,\s*/g);
    }
    if (fields.length > limit) {
      throw new Error(`can't handle more than ${limit} fields in a group at the moment, see cs-field-group's template`);
    }
    return fields;
  }),

  fieldInfo: computed('content', 'fieldName', function() {
    return {
      name: this.get('name'),
      content: this.get('content'),
      grouped: this.get('fieldNames'),
      caption: this.get('groupCaption'),
    };
  }),
}).reopenClass({
  positionalParams: ['content'],
});
