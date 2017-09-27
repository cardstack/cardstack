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
  messagesWithSelectedTag:   computed.readOnly('workflow.messagesWithSelectedTag'),
  selectedDate:              computed.readOnly('workflow.selectedDate'),
  messagesWithSelectedDate:  computed.readOnly('workflow.messagesWithSelectedDate'),
  matchingThreads:          computed.readOnly('workflow.matchingThreads'),
  unhandledForToday:         computed.readOnly('workflow.unhandledForToday'),
  todaysNotificationCount:   computed.readOnly('unhandledForToday.length'),
  selectedMessage:           computed.readOnly('workflow.selectedMessage'),
  shouldShowMatchingThreads: computed.readOnly('workflow.shouldShowMatchingThreads'),

  actions: {
    selectDate(date) {
      this.get('workflow').selectDate(date);
    },

    selectTag(tagId) {
      this.get('workflow').selectTag(tagId);
    },
  }
});
