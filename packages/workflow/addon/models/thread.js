import Ember from 'ember';
import Thread from '@cardstack/models/generated/thread';
import { task } from 'ember-concurrency';
import { computed } from "@ember/object"
import { readOnly } from "@ember/object/computed";

export default Thread.extend({
  priority:       readOnly('_latestMessageWithPriority.priority'),
  priorityLevel:  readOnly('priority.level'),
  updatedAt:      readOnly('latestMessage.sentAt'),

  isUnhandled: computed('_syncedMessages.@each.isUnhandled', function() {
    return this.get('_syncedMessages').any((message) => message.get('isUnhandled'));
  }),

  loadedTags: computed({
    get() {
      this.get('_loadTags').perform();
      return Ember.A();
    },
    set(k, v) {
      return v;
    }
  }),

  loadedTagIds: computed(function() {
    return this.get('loadedTags').map((tag) => tag.get('id'));
  }),

  messagesInReverseChrono: computed('_syncedMessages.[]', function() {
    let sorted = this.get('_syncedMessages').sortBy('sentAt');
    return Ember.A([...sorted].reverse());
  }),

  latestMessage: readOnly('messagesInReverseChrono.firstObject'),

  addMessage(message) {
    this.get('_syncedMessages').addObject(message);
  },

  _latestMessageWithPriority: computed('messagesInReverseChrono.[]', function() {
    return this.get('messagesInReverseChrono').find((message) => {
      let priorityId = message.belongsTo('priority').id();
      return !!priorityId;
    });
  }),

  _syncedMessages: computed({
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
    this.set('_syncedMessages', messages);
  }).restartable(),


  _loadTags: task(function * () {
    let tags = yield this.get('tags');
    this.set('loadedTags', tags);
  }),
});
