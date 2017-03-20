import Ember from 'ember';
import layout from '../templates/components/cs-field-group';
const { guidFor } = Ember;

const limit = 7;

export default Ember.Component.extend({
  layout,
  tagName: '',

  id: Ember.computed('content', 'name', function() {
    return `${guidFor(this.get('content'))}/cs-field-group/${this.get('name')}`;
  }),

  fieldNames: Ember.computed('fields', function() {
    let fields = this.get('fields');
    if (!Array.isArray(fields)) {
      fields = fields.split(/\s*,\s*/g);
    }
    if (fields.length > limit) {
      throw new Error(`can't handle more than ${limit} fields in a group at the moment, see cs-field-group's template`);
    }
    return fields;
  }),

  fieldInfo: Ember.computed('content', 'fieldName', function() {
    return {
      name: this.get('name'),
      content: this.get('content'),
      grouped: this.get('fieldNames')
    };
  })

}).reopenClass({
  positionalParams: ['content']
});
