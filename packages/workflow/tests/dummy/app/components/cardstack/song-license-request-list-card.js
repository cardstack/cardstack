import Component from '@ember/component';
import { inject } from '@ember/service';

export default Component.extend({
  workflow: inject('cardstack-workflow'),

  actions: {
    approve() {
      this.get('workflow').approveMessage(this.get('content'));
    },
    deny() {
      this.get('workflow').denyMessage(this.get('content'));
    },
  },
});
