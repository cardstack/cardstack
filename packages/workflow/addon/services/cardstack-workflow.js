import Ember from 'ember';

const { inject, computed, assert } = Ember;

export const REQUEST_TO_PUBLISH_LIVE = 'Request to publish live';
export const READY_FOR_COPYEDITING = 'Ready for copyediting';
export const COURSE_INFORMATION_SYNCED = 'Course information synced';

export const NEED_RESPONSE = 'Need Response';
export const PROCESSED = 'Processed';
export const FYI = 'For Your Information';

const priorities = [NEED_RESPONSE, PROCESSED, FYI];

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
//   PROCESSED,
//   FYI
// ]
// const tags = [
//   REQUEST_TO_PUBLISH_LIVE,
//   READY_FOR_COPYEDITING,
//   COURSE_INFORMATION_SYNCED
// ];

export default Ember.Service.extend({
  isOpen: false,
  selectedMessage: null,

  store: inject.service(),

  items: computed(function() {
    return this.get('store').findAll('message');
  }),

  unhandledItems:           computed.filterBy('items', 'isHandled', false),
  notificationCount:        computed.readOnly('unhandledItems.length'),
  todaysUnhandledMessages:  computed.filterBy('messagesForToday', 'isHandled', false),

  groupedMessages: computed('items.@each.{priority,tag,isHandled}', function() {
    let messagesByPriority = {};
    messagesByPriority[NEED_RESPONSE] = [];
    messagesByPriority[PROCESSED] = [];
    messagesByPriority[FYI] = [];
    return this.get('items').reduce((messages, message) => {
      let priority = Ember.get(message, 'priority');
      assert(`Unknown priority: ${priority}`, priorities.includes(priority));
      let messagesByTag = messages[priority];
      let tag = Ember.get(message, 'tag');
      if (!messagesByTag[tag]) {
        messagesByTag[tag] = {
          all: [],
          unhandled: [],
        };
      }
      let messagesWithTag = messagesByTag[tag];
      messagesWithTag.all.push(message);
      if (!Ember.get(message, 'isHandled')) {
        messagesWithTag.unhandled.push(message);
      }
      return messages;
    }, messagesByPriority);
  }),

  messagesForToday: messagesBetween('items', 'updatedAt', {
    from: moment().subtract(1, 'day')
  }),

  selectedTag:    '',
  //FIXME: This is not recomputed after handling a message, although unhandledItems is :o
  messagesWithSelectedTag: computed('unhandledItems.@each.tag', 'selectedTag', function() {
    let withSelectedTag = this.get('unhandledItems').filterBy('tag', this.get('selectedTag'));
    // console.log('messagesWithSelectedTag #: ' + withSelectedTag.length);
    return withSelectedTag;
  }),

  selectedDate: '',
  messagesWithSelectedDate: computed('selectedDate', function() {
    if (this.get('selectedDate') === 'today') {
      return this.get('todaysUnhandledMessages');
    }
    return [];
  }),

  shouldShowMessagesInGroup: computed.or('selectedTag', 'selectedDate'),

  matchingMessages: computed('selectedTag', 'selectedDate', function() {
    if (this.get('selectedTag')) {
      return this.get('messagesWithSelectedTag');
    }
    if (this.get('selectedDate')) {
      return this.get('messagesWithSelectedDate');
    }
    return [];
  }),

  selectDate(date) {
    this.setProperties({
      selectedDate: date,
      selectedTag: null
    });
    this.clearSelectedMessage();
  },

  selectTag(tag) {
    this.setProperties({
      selectedDate: null,
      selectedTag: tag
    });
    this.clearSelectedMessage();
  },

  selectMessage(message) {
    this.set('selectedMessage', message);
    // this.clearGroupSelection();
  },

  clearGroupSelection() {
    this.setProperties({
      selectedDate: null,
      selectedTag: null
    });
  },

  clearSelectedMessage() {
    this.set('selectedMessage', null);
  },

  approveMessage(message) {
    message.set('status', 'approved');
    this.clearSelectedMessage();
  },

  denyMessage(message) {
    message.set('status', 'denied');
    this.clearSelectedMessage();
  }
});
