import Ember from 'ember';
import DS from 'ember-data';
import Thread from '@cardstack/models/generated/thread';

const { computed, isPresent } = Ember;

export default Thread.extend({
  //TODO: `status` should be the status of the latest message in the thread
  //`priority` should be the priority of the latest message in the thread
  priority: computed('messages.[]', function() {
    let firstWithPriority = this.get('_messagesInReverseChrono').find((message) => {
      debugger;
      let priorityId = message.belongsTo('priority').id();
      return isPresent(priorityId);
    });
    return firstWithPriority.get('priority');
  }),

  isHandled: computed('priority', function() {
    return this.get('priority.value') > 20;
  }),

  _messagesInReverseChrono: computed('messages.[]', function() {
    return this.get('messages').sortBy('updatedAt');
  })
});
