import Ember from 'ember';
import layout from '../templates/components/cs-field';
const { guidFor } = Ember;
import { fieldType } from '../helpers/cs-field-editor-for';

export default Ember.Component.extend({
  layout,
  tagName: '',

  id: Ember.computed('content', 'fieldName', function() {
    return `${guidFor(this.get('content'))}/cs-field/${this.get('fieldName')}`;
  }),

  defaultRenderer: Ember.computed('content', 'fieldName', function() {
    return `field-renderers/${fieldType(this.get('content'), this.get('fieldName'))}-renderer`;
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
