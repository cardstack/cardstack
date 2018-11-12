import Component from '@ember/component';
import { inject } from '@ember/service';

export default Component.extend({
  workflow: inject('cardstack-workflow'),

  actions: {
    approve() {
      this.get('workflow').approveSongLicenseRequest(this.get('content'));
    },
    deny() {
      this.get('workflow').denySongLicenseRequest(this.get('content'));
    },
  },
});
