import Ember from 'ember';
import layout from '../templates/components/cs-field';
const { guidFor } = Ember;
import { fieldType } from '../helpers/cs-field-type';
import { fieldCaption } from '../helpers/cs-field-caption';
import injectOptional from 'ember-inject-optional';

export default Ember.Component.extend({
  layout,
  tagName: '',

  // if cardstack tools is present, we use it to decide to be active,
  // otherwise we are never active because no editing tools are
  // present.
  tools: injectOptional.service('cardstack-tools'),

  fieldType: Ember.computed('content', 'fieldName', function() {
    return fieldType(this.get('content'), this.get('fieldName'));
  }),

  fieldCaption: Ember.computed('content', 'fieldName', function() {
    return fieldCaption(this.get('content'), this.get('fieldName'));
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

  fieldInfo: Ember.computed('content', 'fieldName', 'fieldCaption', function() {
    return {
      name: this.get('fieldName'),
      content: this.get('content'),
      caption: this.get('fieldCaption')
    };
  }),
}).reopenClass({
  positionalParams: ['content', 'fieldName']
});
