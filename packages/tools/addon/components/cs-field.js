import Ember from 'ember';
import layout from '../templates/components/cs-field';
const { guidFor } = Ember;

export default Ember.Component.extend({
  layout,
  id: Ember.computed('content', 'fieldName', function() {
    return `${guidFor(this.get('content'))}/${this.get('fieldName')}`;
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
