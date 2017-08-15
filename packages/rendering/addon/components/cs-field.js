import Ember from 'ember';
import layout from '../templates/components/cs-field';
const { guidFor } = Ember;
import { fieldType } from '../helpers/cs-field-type';

export default Ember.Component.extend({
  layout,
  tagName: '',

  // This is not a plain injection because it's optional -- if
  // cardstack tools is present, we use it, otherwise we are never
  // active and it doesn't matter.
  tools: Ember.computed(function() {
    return Ember.getOwner(this).lookup('service:cardstack-tools');
  }),

  fieldType: Ember.computed('content', 'fieldName', function() {
    return fieldType(this.get('content'), this.get('fieldName'));
  }),

  fieldConfig: Ember.computed('fieldType', function() {
    let type = this.get('fieldType');
    if (type) {
      return Ember.getOwner(this).resolveRegistration(`field-type:${type}`);
    }
  }),

  id: Ember.computed('content', 'fieldName', function() {
    return `${guidFor(this.get('content'))}/cs-field/${this.get('fieldName')}`;
  }),

  defaultRenderer: Ember.computed('fieldType', function() {
    return `field-renderers/${this.get('fieldType')}-renderer`;
  }),

  fieldInfo: Ember.computed('content', 'fieldName', function() {
    return {
      name: this.get('fieldName'),
      content: this.get('content')
    };
  }),
}).reopenClass({
  positionalParams: ['content', 'fieldName']
});
