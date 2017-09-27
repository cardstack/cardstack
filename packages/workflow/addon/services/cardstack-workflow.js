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
  selectedThread: null,

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

  groupedThreads: computed('items.@each.{priority,loadedTags}', function() {
    return this.get('items').reduce((groupedThreads, thread) => {
      let priority = thread.get('priority');
      let priorityId = priority.get('id');
      if (!groupedThreads[priorityId]) {
        groupedThreads[priorityId] = {
          name: priority.get('name'),
          tagGroups: {}
        };
      }

      let threadsForPriority = groupedThreads[priorityId];
      let tags = thread.get('loadedTags');
      for (let i=0; i<tags.length; i++) {
        let tag = tags.objectAt(i);
        let tagId = tag.get('id');
        if (!threadsForPriority.tagGroups[tagId]) {
          threadsForPriority.tagGroups[tagId] = {
            name: tag.get('name'),
            priorityLevel: thread.get('priorityLevel'),
            all: []
          }
        }
        let threadsForTag = threadsForPriority.tagGroups[tagId];
        threadsForTag.all.push(thread);
        // if (thread.get('isImportant')) {
        //   threadsWithTag.important.push(thread);
        // }
      }
      return groupedThreads;
    }, {});
  }),

  threadsUpdatedToday: threadsBetween('items', 'updatedAt', {
    from: moment().subtract(1, 'day')
  }),

  selectedTag:    '',
  messagesWithSelectedTag: computed('items.@each.loadedTagIds', 'selectedTag', function() {
    let selectedTagId = this.get('selectedTag.id');
    let withSelectedTag = this.get('items').filter((thread) => thread.get('loadedTagIds').includes(selectedTagId));
    return withSelectedTag;
  }),

  selectedDate: '',
  messagesWithSelectedDate: computed('selectedDate', function() {
    if (this.get('selectedDate') === 'today') {
      return this.get('todaysUnhandledMessages');
    }
    return [];
  }),

  shouldShowMatchingThreads: or('selectedTag', 'selectedDate'),

  matchingThreads: computed('selectedTag', 'selectedDate', 'messagesWithSelectedTag', 'messagesWithSelectedDate', function() {
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

  selectTag(tagId) {
    let selectedTag = this.get('store').peekRecord('tag', tagId);
    this.setProperties({
      selectedDate: null,
      selectedTag
    });
    this.clearSelectedMessage();
  },

  selectThread(thread) {
    this.set('selectedThread', thread);
  },

  clearGroupSelection() {
    this.setProperties({
      selectedDate: null,
      selectedTag: null
    });
  },

  clearSelectedMessage() {
    this.set('selectedThread', null);
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
