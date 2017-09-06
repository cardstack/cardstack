import Ember from 'ember';
import layout from '../templates/components/cardstack-toolbox';
import injectOptional from 'ember-inject-optional';

export default Ember.Component.extend({
  layout,
  classNames: ['cardstack-toolbox', 'cardstack-tools', 'cardstack-toolbox-width'],
  cardstackRouting: injectOptional.service('cardstack-routing'),
  tools: Ember.inject.service('cardstack-tools')
});
