import layout from '../templates/components/cs-field-alternatives';
import { humanize } from '../helpers/cs-humanize';
import Component from '@ember/component';
import { computed } from '@ember/object';
import { guidFor } from '@ember/object/internals';
import { A } from '@ember/array';

export default Component.extend({
  layout,
  tagName: '',
  alternativesList: A(),

  id: computed('content', 'name', function() {
    return `${guidFor(this.get('content'))}/cs-field-alternatives/${this.get('name')}`;
  }),

  groupCaption: computed('caption', 'name', function() {
    return this.get('caption') || humanize(this.get('name'));
  }),

  fieldInfo: computed('content', 'fieldName', function() {
    return {
      name: this.get('name'),
      content: this.get('content'),
      alternatives: this.get('alternativesList'),
      caption: this.get('groupCaption')
    };
  }),

  actions: {
    registerAlternative(alternative) {
      this.get('alternativesList').pushObject(alternative);
    }
  }

}).reopenClass({
  positionalParams: ['content']
});
