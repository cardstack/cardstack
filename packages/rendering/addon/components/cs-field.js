import { getOwner } from '@ember/application';
import { computed } from '@ember/object';
import Component from '@ember/component';
import { guidFor } from '@ember/object/internals';
import layout from '../templates/components/cs-field';
import { fieldType } from '../helpers/cs-field-type';
import { fieldCaption } from '../helpers/cs-field-caption';
import injectOptional from 'ember-inject-optional';

export default Component.extend({
  layout,
  tagName: '',

  // if cardstack tools is present, we use it to decide to be active,
  // otherwise we are never active because no editing tools are
  // present.
  tools: injectOptional.service('cardstack-tools'),

  fieldType: computed('content', 'fieldName', function() {
    return fieldType(this.get('content'), this.get('fieldName'));
  }),

  fieldCaption: computed('content', 'fieldName', function() {
    return fieldCaption(this.get('content'), this.get('fieldName'));
  }),

  fieldConfig: computed('fieldType', function() {
    let type = this.get('fieldType');
    if (type) {
      return getOwner(this).resolveRegistration(`field-type:${type}`);
    }
  }),

  id: computed('content', 'fieldName', function() {
    return `${guidFor(this.get('content'))}/cs-field/${this.get('fieldName')}`;
  }),

  defaultRenderer: computed('fieldType', function() {
    return `field-renderers/${this.get('fieldType')}-renderer`;
  }),

  fieldInfo: computed('content', 'fieldName', 'fieldCaption', function() {
    return {
      name: this.get('fieldName'),
      content: this.get('content'),
      caption: this.get('fieldCaption'),
    };
  }),
}).reopenClass({
  positionalParams: ['content', 'fieldName'],
});
