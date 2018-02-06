import Ember from 'ember';
import layout from '../templates/components/cardstack-tools';

export default Ember.Component.extend({
  layout,
  tagName: "",
  tools: Ember.inject.service('cardstack-tools')
});
