import Ember from 'ember';
import { workflowGroupId } from '@cardstack/workflow/helpers/workflow-group-id';

const { inject, computed, assert } = Ember;

// Priorities (fixed, provided by the Cardstack framework)
export const NEED_RESPONSE = 'Need Response';
export const PROCESSED = 'Processed';
export const FYI = 'For Your Information';

// Tags: that should be "dynamic", supplied by the user
// or extracted from the messages themselves
export const REQUEST_TO_PUBLISH_LIVE = 'Request to publish live';
export const LICENSE_REQUEST = 'License Request';
export const READY_FOR_COPYEDITING = 'Ready for copyediting';
export const COURSE_INFORMATION_SYNCED = 'Course information synced';

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

  groupedMessages: computed('items.@each.{priority,tag,isHandled}', function() {
    function emptyGroup() {
      return {
        all: [],
        unhandled: []
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
      if (!Ember.get(message, 'isHandled')) {
        messagesWithTag.unhandled.push(message);
      }
      return messages;
    }, messagesByPriority);
  }),

  messagesForToday: messagesBetween('items', 'updatedAt', {
    from: moment().subtract(1, 'day')
  }),

  selectedGroup:    '',
  //FIXME: This is not recomputed after handling a message, although unhandledItems is :o
  messagesInSelectedGroup: computed('unhandledItems.@each.groupId', 'selectedGroup', function() {
    let withSelectedGroup = this.get('unhandledItems').filterBy('groupId', this.get('selectedGroup'));
    return withSelectedGroup;
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
    // this.clearGroupSelection();
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
