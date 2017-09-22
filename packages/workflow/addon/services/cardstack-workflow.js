import Service from "@ember/service"
import { task } from 'ember-concurrency';
import { inject } from "@ember/service";
import { computed } from "@ember/object";
import { readOnly, filterBy, or } from "@ember/object/computed";

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
  selectedMessage: null,

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

  /*
  groupedThreads: computed('items.@each.{priority,tag,isImportant}', function() {
    function emptyGroup() {
      return {
        all: [],
        important: [],
      }
    }

    return this.get('items').reduce((threads, thread) => {
      let priority = thread.get('priority');
      let threadsByTag = threads[priority];
      let tag = threads.get('tag');
      if (!threadsByTag[tag]) {
        threadsByTag[tag] = emptyGroup(priority);
      }
      let threadsWithTag = threadsByTag[tag];
      threadsWithTag.all.push(thread);
      if (thread.get('isImportant')) {
        threadsWithTag.important.push(thread);
      }
      return threads;
    }, {});
  }),
  */

  threadsUpdatedToday: threadsBetween('items', 'updatedAt', {
    from: moment().subtract(1, 'day')
  }),

  selectedGroup:    '',
  messagesInSelectedGroup: computed('items.@each.{groupId,isImportant}', 'selectedGroup', function() {
    let inselectedGroup = this.get('items').filterBy('groupId', this.get('selectedGroup'));
    return inselectedGroup.filter((message) => message.get('isImportant'));
  }),

  selectedDate: '',
  messagesWithSelectedDate: computed('selectedDate', function() {
    if (this.get('selectedDate') === 'today') {
      return this.get('todaysUnhandledMessages');
    }
    return [];
  }),

  shouldShowMessagesInGroup: or('selectedGroup', 'selectedDate'),

  matchingMessages: computed('selectedGroup', 'selectedDate', 'messagesInSelectedGroup', 'messagesWithSelectedDate', function() {
    if (this.get('selectedGroup')) {
      return this.get('messagesInSelectedGroup');
    }
    if (this.get('selectedDate')) {
      return this.get('messagesWithSelectedDate');
    }
    return [];
  }),

  selectDate(date) {
    this.setProperties({
      selectedDate: date,
      selectedGroup: null
    });
    this.clearSelectedMessage();
  },

  selectGroup(groupId) {
    this.setProperties({
      selectedDate: null,
      selectedGroup: groupId
    });
    this.clearSelectedMessage();
  },

  selectMessage(message) {
    this.set('selectedMessage', message);
  },

  clearGroupSelection() {
    this.setProperties({
      selectedDate: null,
      selectedGroup: null
    });
  },

  clearSelectedMessage() {
    this.set('selectedMessage', null);
  },

  approveMessage(message) {
    message.setProperties({
      status: 'approved',
      priority: PROCESSED
    });
    this.clearSelectedMessage();
  },

  denyMessage(message) {
    message.setProperties({
      status: 'denied',
      priority: PROCESSED
    });
    this.clearSelectedMessage();
  }
});
