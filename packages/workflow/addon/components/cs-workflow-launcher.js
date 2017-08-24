import Ember from 'ember';
import layout from '../templates/components/cs-workflow-launcher';

const { Component, inject, computed } = Ember;

export default Component.extend({
  layout,
  classNames: ['cs-workflow-launcher'],
  workflow: inject.service('cardstack-workflow'),
  notificationCount: computed.readOnly('workflow.notificationCount'),
  isOpen: false,

  actions: {
    toggleDetails() {
      this.toggleProperty('isOpen');
    }
  }
});
