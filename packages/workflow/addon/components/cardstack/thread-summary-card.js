import Component from '@ember/component';
import { computed } from '@ember/object';
import { readOnly } from '@ember/object/computed';
// import layout from '../../templates/components/cardstack/thread-summary-card';

export default Component.extend({
  //  layout,
  classNames: ['cardstack-thread-summary-card'],
  thread: null,
  messages: readOnly('thread.sortedMessages'),

  latestCard: computed('messages.@each.{isUnhandled,loadedCard}', function() {
    let latestUnhandled = this.get('messages').find(message => {
      return message.get('isUnhandled') && message.get('cardType') !== 'chat-messages';
    });

    if (latestUnhandled) {
      return latestUnhandled.get('loadedCard');
    }
  }),
});
