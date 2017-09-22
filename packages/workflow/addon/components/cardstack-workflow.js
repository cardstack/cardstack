import Ember from 'ember';
import layout from '../templates/components/cardstack-workflow';

const { inject, computed } = Ember;

export default Ember.Component.extend({
  layout,
  classNames:  ['cardstack-workflow'],
  workflow:    inject.service('cardstack-workflow'),

  groupedThreads:            computed.readOnly('workflow.groupedThreads'),
  unhandled:                 computed.readOnly('workflow.unhandledItems'),
  selectedGroup:             computed.readOnly('workflow.selectedGroup'),
  messagesInSelectedGroup:   computed.readOnly('workflow.messagesInSelectedGroup'),
  selectedDate:              computed.readOnly('workflow.selectedDate'),
  messagesWithSelectedDate:  computed.readOnly('workflow.messagesWithSelectedDate'),
  matchingMessages:          computed.readOnly('workflow.matchingMessages'),
  unhandledForToday:         computed.readOnly('workflow.unhandledForToday'),
  todaysNotificationCount:   computed.readOnly('unhandledForToday.length'),
  selectedMessage:           computed.readOnly('workflow.selectedMessage'),
  shouldShowMessagesInGroup: computed.readOnly('workflow.shouldShowMessagesInGroup'),

  actions: {
    selectDate(date) {
      this.get('workflow').selectDate(date);
    },

    selectGroup(groupId) {
      this.get('workflow').selectGroup(groupId);
    },
  }
});
