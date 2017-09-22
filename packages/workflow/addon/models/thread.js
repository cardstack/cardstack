import Ember from 'ember';
import Thread from '@cardstack/models/generated/thread';
import { task } from 'ember-concurrency';
import { computed } from "@ember/object"
import { readOnly } from "@ember/object/computed";

export default Thread.extend({
  priority:     readOnly('_latestMessageWithPriority.priority'),
  isUnhandled:  readOnly('priority.isUnhandled'),
  updatedAt:    readOnly('_latestMessage.sentAt'),

  //TODO: `status` should be the status of the latest message in the thread

  _latestMessage: readOnly('_messagesInReverseChrono.firstObject'),

  _latestMessageWithPriority: computed('_messagesInReverseChrono.[]', function() {
    return this.get('_messagesInReverseChrono').find((message) => {
      let priorityId = message.belongsTo('priority').id();
      return !!priorityId;
    });
  }),

  _syncMessages: computed({
    get() {
      this.get('_loadMessages').perform();
      return Ember.A();
    },
    set(k,v) {
      return v;
    }
  }),

  _loadMessages: task(function * () {
    let messages = yield this.get("messages");
    this.set('_syncMessages', messages);
  }).restartable(),

  _messagesInReverseChrono: computed('_syncMessages.[]', function() {
    let sorted = this.get('_syncMessages').sortBy('sentAt');
    return Ember.A([...sorted].reverse());
  })
});
