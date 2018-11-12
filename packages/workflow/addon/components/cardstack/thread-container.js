import Component from '@ember/component';
import { inject } from '@ember/service';
import { empty } from '@ember/object/computed';

export default Component.extend({
  workflow: inject('cardstack-workflow'),

  thread: null,

  newMessageText: '',

  isEmptyNewMessage: empty('newMessageText'),

  actions: {
    sendMessage() {
      this.get('workflow')
        .createChatMessage({
          text: this.get('newMessageText'),
          thread: this.get('thread'),
        })
        .then(() => {
          this.set('newMessageText', '');
        });
    },
  },
});
