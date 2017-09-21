import Ember from 'ember';
import DS from 'ember-data';
import Thread from '@cardstack/models/generated/thread';
import { task } from 'ember-concurrency';

const { computed, isPresent } = Ember;

export default Thread.extend({
  //TODO: `status` should be the status of the latest message in the thread
  //`priority` should be the priority of the latest message in the thread
  priority: computed('_messagesInReverseChrono.[]', function() {
    let firstWithPriority = this.get('_messagesInReverseChrono').find((message) => {
      let priorityId = message.belongsTo('priority').id();
      return isPresent(priorityId);
    });
    if (firstWithPriority) {
      return firstWithPriority.get('priority');
    }
  }),

  isHandled: computed('priority', function() {
    return this.get('priority.value') > 20;
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
