import Ember from 'ember';
import layout from '../templates/components/cardstack-workflow-launcher';

const { Component, inject, computed } = Ember;

export default Component.extend({
  layout,
  classNames: ['cardstack-workflow-launcher'],
  workflow: inject.service('cardstack-workflow'),
  notificationCount: computed.readOnly('workflow.notificationCount'),

  isOpen: false,

  actions: {
    toggleDetails() {
      this.toggleProperty('isOpen');
    }
  }
});
