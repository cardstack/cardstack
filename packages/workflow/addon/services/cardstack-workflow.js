import Ember from 'ember';

const { inject, computed, assert } = Ember;

export const REQUEST_TO_PUBLISH_LIVE = 'Request to publish live';
export const READY_FOR_COPYEDITING = 'Ready for copyediting';
export const COURSE_INFORMATION_SYNCED = 'Course information synced';

export const NEED_RESPONSE = 'Need Response';
export const AUTO_PROCESSED = 'Automatically Processed';
export const FYI = 'For Your Information';

const priorities = [NEED_RESPONSE, AUTO_PROCESSED, FYI];

function messagesBetween(arrayKey, dateKey, { from, to }) {
  return Ember.computed(`${arrayKey}.@each.${dateKey}`, function() {
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

// const priorities = [
//   NEED_RESPONSE,
//   AUTO_PROCESSED,
//   FYI
// ]
// const tags = [
//   REQUEST_TO_PUBLISH_LIVE,
//   READY_FOR_COPYEDITING,
//   COURSE_INFORMATION_SYNCED
// ];

export default Ember.Service.extend({
  isOpen: false,

  store: inject.service(),

  items: computed(function() {
    return this.get('store').findAll('message');
  }),

  unhandledItems:           computed.filterBy('items', 'isHandled', false),
  notificationCount:        computed.readOnly('unhandledItems.length'),
  todaysUnhandledMessages:  computed.filterBy('messagesForToday', 'isHandled', false),

  groupedMessages: computed('items.@each.{priority,tag}', function() {
    let messagesByPriority = {};
    messagesByPriority[NEED_RESPONSE] = [];
    messagesByPriority[AUTO_PROCESSED] = [];
    messagesByPriority[FYI] = [];
    return this.get('items').reduce((messages, message) => {
      let priority = Ember.get(message, 'priority');
      assert(`Unknown priority: ${priority}`, priorities.includes(priority));
      let messagesByTag = messages[priority];
      let tag = Ember.get(message, 'tag');
      if (!messagesByTag[tag]) {
        messagesByTag[tag] = {
          messages: [],
          unhandledCount: 0,
        };
      }
      messagesByTag[tag].messages.push(message);
      if (!Ember.get(message, 'isHandled')) {
        messagesByTag[tag].unhandledCount += 1;
      }
      return messages;
    }, messagesByPriority);
  }),

  messagesForToday: messagesBetween('items', 'updatedAt', {
    from: moment().subtract(1, 'day')
  }),
});
