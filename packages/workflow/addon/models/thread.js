import Ember from 'ember';
import Thread from '@cardstack/models/generated/thread';
import { task } from 'ember-concurrency';
import { computed } from "@ember/object"
import { readOnly } from "@ember/object/computed";
import RSVP from 'rsvp';

export default Thread.extend({
  priority:       readOnly('_latestMessageWithPriority.priority'),
  priorityLevel:  readOnly('priority.level'),
  updatedAt:      readOnly('latestMessage.sentAt'),

  isUnhandled: computed('_syncedMessages.@each.isUnhandled', function() {
    return this.get('_syncedMessages').any((message) => message.get('isUnhandled'));
  }),

  tags: computed('_syncedMessages.[]', {
    get() {
      this.get('loadTags').perform();
      return Ember.A();
    },
    set(k, v) {
      return v;
    }
  }),

  loadTags: task(function * () {
    let tagLoadingTasks = this.get('_syncedMessages').map((message) => {
      //  _loadTags has a side-effect as it also sets its `loadedTags`
      // this might cause problems, so we can split the task that also mutates
      // into a "pure" task and a setter.
      return message.get('_loadTags').perform();
    });
    let tags = yield RSVP.all(tagLoadingTasks);
    let flattenedTags = tags.reduce((flattenedTags, tagsForMessage) => {
      return flattenedTags.concat(tagsForMessage.toArray());
    }, []);
    this.set('tags', flattenedTags);
  }),

  tagIds: computed(function() {
    return this.get('tags').map((tag) => tag.get('id'));
  }),

  sortedMessages: computed('_syncedMessages.[]', function() {
    return this.get('_syncedMessages').sortBy('sentAt');
  }),

  latestMessage: readOnly('sortedMessages.lastObject'),

  addMessages(messages) {
    this.get('_syncedMessages').addObjects(messages);
  },

  _latestMessageWithPriority: computed('sortedMessages.[]', function() {
    return this.get('sortedMessages').find((message) => {
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
});
