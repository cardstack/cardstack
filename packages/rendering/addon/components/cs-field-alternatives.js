import layout from '../templates/components/cs-field-alternatives';
import { humanize } from '../helpers/cs-humanize';
import Component from '@ember/component';
import { computed, get } from '@ember/object';
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

  alternativesStatus: computed('content', 'alternativesList.[]', function() {
    // One alternative should be marked as enabled at all times
    //Check which alternative has data
    let content = this.get('content');
    let alternativesList = this.get('alternativesList');
    
    let alternativesWithData = alternativesList
      .filter((alternative) => {
        let hasData = get(alternative, 'fieldNames')
          .map((fieldName) => get(content, fieldName))
          .filter((data) => !!data);
        return get(hasData, 'length') > 0;
      });
    let firstWithData = (alternativesWithData.length > 0) ? alternativesWithData[0] : null;

    // Select first with data or first in list
    let activeName = (firstWithData) ? get(firstWithData, 'name') : get(alternativesList, 'firstObject.name');
    return {
      [activeName]: true
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
