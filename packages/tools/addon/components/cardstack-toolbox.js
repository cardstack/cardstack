import Ember from 'ember';
import layout from '../templates/components/cardstack-toolbox';

export default Ember.Component.extend({
  layout,
  classNames: ['cardstack-toolbox', 'cardstack-tools', 'cardstack-toolbox-width'],
  tools: Ember.inject.service('cardstack-tools')
});
