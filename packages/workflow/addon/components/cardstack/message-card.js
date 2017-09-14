import Ember from 'ember';

export default Ember.Component.extend({
  workflow: Ember.inject.service('cardstack-workflow'),

  actions: {
    approve() {
      this.get('workflow').approveMessage(this.get('content'));
    },
    deny() {
      this.get('workflow').denyMessage(this.get('content'));
    }
  }
});
