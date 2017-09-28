import Component from "@ember/component";
import { inject } from "@ember/service";

export default Component.extend({
  workflow: inject('cardstack-workflow'),

  thread: null,

  newMessageText: '',

  actions: {
    sendMessage() {
      this.get('workflow').createMessage({
        text: this.get('newMessageText'),
        thread: this.get('thread')
      }).then(() => {
        this.set('newMessageText', '');
      });
    }
  }
});
