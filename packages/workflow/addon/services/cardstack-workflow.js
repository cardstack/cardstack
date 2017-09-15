import Ember from 'ember';
import {
  // Priorities
  NEED_RESPONSE,
  PROCESSED,
  FYI,
  // Tags
  REQUEST_TO_PUBLISH_LIVE,
  LICENSE_REQUEST,
  READY_FOR_COPYEDITING,
} from '@cardstack/workflow/models/message';

const { inject, computed, assert } = Ember;

const staticGroups = {};
staticGroups[NEED_RESPONSE] = [REQUEST_TO_PUBLISH_LIVE, LICENSE_REQUEST, READY_FOR_COPYEDITING];

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

  groupedMessages: computed('items.@each.{priority,tag,isImportant}', function() {
    function emptyGroup() {
      return {
        all: [],
        important: []
      }
    }
    let messagesByPriority = {};
    priorities.forEach((priority) => {
      messagesByPriority[priority] = [];
      let staticTagsForPriority = staticGroups[priority];
      if (staticTagsForPriority) {
        staticTagsForPriority.forEach((tag) => {
          messagesByPriority[priority][tag] = emptyGroup();
        });
      }
    });

    return this.get('items').reduce((messages, message) => {
      let priority = Ember.get(message, 'priority');
      assert(`Unknown priority: ${priority}`, priorities.includes(priority));
      let messagesByTag = messages[priority];
      let tag = Ember.get(message, 'tag');
      if (!messagesByTag[tag]) {
        messagesByTag[tag] = emptyGroup();
      }
      let messagesWithTag = messagesByTag[tag];
      messagesWithTag.all.push(message);
      if (message.get('isImportant')) {
        messagesWithTag.important.push(message);
      }
      return messages;
    }, messagesByPriority);
  }),

  messagesForToday: messagesBetween('items', 'updatedAt', {
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

  shouldShowMessagesInGroup: computed.or('selectedGroup', 'selectedDate'),

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
