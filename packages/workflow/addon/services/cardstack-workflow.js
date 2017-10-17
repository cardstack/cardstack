import Service from "@ember/service"
import { task } from 'ember-concurrency';
import { inject } from "@ember/service";
import { computed } from "@ember/object";
import { readOnly, filterBy } from "@ember/object/computed";
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import { assign } from "@ember/polyfills";

function threadsBetween(arrayKey, dateKey, { from, to }) {
  return computed(`${arrayKey}.@each.${dateKey}`, function() {
    return this.get(arrayKey).filter((item) => {
      let date = moment(item.get(dateKey));
      if (from && to) {
        return date >= from && date <= to;
      }
      if (to) {
        return date <= to;
      }
      if (from) {
        return date >= from;
      }
    });
  });
}

export default Service.extend({
  isOpen: false,

  store: inject(),

  loadItems: task(function * () {
    let threads = yield this.get('store').findAll('thread');
    this.set('items', threads);
  }).restartable().on('init'),

  init() {
    this._super();
    this.items = [];
  },

  unhandledItems:           filterBy('items', 'isUnhandled'),
  notificationCount:        readOnly('unhandledItems.length'),
  unhandledForToday:        filterBy('threadsUpdatedToday', 'isUnhandled'),
  todaysNotificationCount:  readOnly('unhandledForToday.length'),

  groupedThreads: computed('items.@each.{priority,tags,isUnhandled}', function() {
    return this.get('items').reduce((groupedThreads, thread) => {
      if (thread.get('isNew')) {
        return groupedThreads;
      }

      let priority = thread.get('priority');
      let priorityId = priority.get('id');
      if (!groupedThreads[priorityId]) {
        groupedThreads[priorityId] = {
          name: priority.get('name'),
          tagGroups: {}
        };
      }

      let threadsForPriority = groupedThreads[priorityId];
      let tags = thread.get('tags');
      for (let i=0; i<tags.length; i++) {
        let tag = tags[i];
        let tagId = tag.get('id');
        if (!threadsForPriority.tagGroups[tagId]) {
          threadsForPriority.tagGroups[tagId] = {
            name: tag.get('name'),
            priorityLevel: thread.get('priorityLevel'),
            all: [],
            unhandled: [],
          }
        }
        let threadsForTag = threadsForPriority.tagGroups[tagId];
        threadsForTag.all.push(thread);
        if (thread.get('isUnhandled')) {
          threadsForTag.unhandled.push(thread);
        }
      }
      return groupedThreads;
    }, {});
  }),

  threadsUpdatedToday: threadsBetween('items', 'updatedAt', {
    from: moment().subtract(1, 'day')
  }),

  process(message) {
    message.handle();
  },

  createMessage(properties={}) {
    let messageProperties = assign({
      sentAt: moment(),
      status: 'unhandled',
    }, properties);
    return this.get('store').createRecord('message', messageProperties);
  },

  createMessageFor(model, properties={}) {
    let messageProperties = assign({
      sentAt: moment(),
      status: 'unhandled',
      cardId: model.get('id'),
      cardType: modelType(model)
    }, properties);
    return this.get('store').createRecord('message', messageProperties);
  },

  createChatMessage({ thread, text }) {
    let chatMessage = this.get('store').createRecord('chat-message', { text });
    return chatMessage.save()
      .then((chatMessage) => {
        let message = this.createMessageFor(chatMessage);
        return message.save();
      })
      .then((message) => {
        thread.addMessages([message]);
      });
  },
});
