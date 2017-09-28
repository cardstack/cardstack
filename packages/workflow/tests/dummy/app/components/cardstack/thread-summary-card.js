import Component from "@ember/component";
import { computed } from '@ember/object';
import { readOnly } from "@ember/object/computed";

export default Component.extend({
  classNames: ['cardstack-thread-summary-card'],
  thread: null,
  messages: readOnly('thread.messagesInReverseChrono'),

  latestCard: computed('messages.@each.{isUnhandled,loadedCard}', function() {
    let latestUnhandled = this.get('messages').find((message) => {
      return message.get('isUnhandled') && message.get('cardType') !== 'chat-messages';
    });

    if (latestUnhandled) {
      return latestUnhandled.get('loadedCard');
    }
  }),
});

