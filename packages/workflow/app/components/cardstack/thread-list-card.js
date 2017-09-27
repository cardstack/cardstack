import Ember from 'ember';

export default Ember.Component.extend({
  workflow: Ember.inject.service('cardstack-workflow'),

  actions: {
    select() {
      this.get('workflow').selectThread(this.get('content'));
    }
  }
});
