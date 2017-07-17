import Ember from 'ember';
import layout from '../templates/components/cs-field';
const { guidFor } = Ember;
import { fieldType } from '../helpers/cs-field-editor-for';

export default Ember.Component.extend({
  layout,
  tagName: '',
  tools: Ember.inject.service('cardstack-tools'),

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
