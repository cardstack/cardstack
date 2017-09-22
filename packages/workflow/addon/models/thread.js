import Ember from 'ember';
import Thread from '@cardstack/models/generated/thread';
import { computed } from "@ember/object"
import { readOnly } from "@ember/object/computed";
import { task } from 'ember-concurrency';

export default Thread.extend({
  priority: readOnly('_latestMessageWithPriority.priority'),
  //TODO: `status` should be the status of the latest message in the thread
  //TODO: `tag` should be the status of the latest message in the thread

  isUnhandled: readOnly('priority.isUnhandled'),

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
    return this.get('_syncMessages').sortBy('updatedAt');
  })
});
