import Ember from 'ember';
import layout from '../templates/components/cs-field';

export default Ember.Component.extend({
  layout
}).reopenClass({
  positionalParams: ['content', 'fieldName']
});
