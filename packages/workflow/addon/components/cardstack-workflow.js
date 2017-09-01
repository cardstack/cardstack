import Ember from 'ember';
import layout from '../templates/components/cardstack-workflow';

const { inject, computed } = Ember;

export default Ember.Component.extend({
  layout,
  classNames: ['cardstack-workflow'],
  workflow: inject.service('cardstack-workflow'),

  messagesByTag: computed.readOnly('workflow.messagesByTag'),
});
