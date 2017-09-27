import Component from "@ember/component";
import { inject } from "@ember/service";

export default Component.extend({
  workflow: inject('cardstack-workflow'),

  thread: null,

  actions: {
    select() {
      this.get('workflow').selectThread(this.get('thread'));
    }
  }
});
