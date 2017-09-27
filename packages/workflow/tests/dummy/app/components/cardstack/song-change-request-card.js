import Component from "@ember/component";
import { inject } from "@ember/service";

export default Component.extend({
  workflow: inject('cardstack-workflow'),

  actions: {
    approve() {
      this.get('workflow').approveSongChangeRequest(this.get('content'));
    },
    deny() {
      this.get('workflow').denySongChangeRequest(this.get('content'));
    }
  }
});

