import Ember from 'ember';
import layout from '../templates/components/cardstack-workflow';

const { inject, computed } = Ember;

export default Ember.Component.extend({
  layout,
  classNames: ['cardstack-workflow'],
  workflow: inject.service('cardstack-workflow'),

  changesByCategory: computed.readOnly('workflow.changesByCategory'),
});
