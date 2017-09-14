import Ember from 'ember';
import layout from '../templates/components/cardstack-workflow';

const { inject, computed } = Ember;

export default Ember.Component.extend({
  layout,
  classNames:  ['cardstack-workflow'],
  workflow:    inject.service('cardstack-workflow'),

  groupedMessages:           computed.readOnly('workflow.groupedMessages'),
  unhandled:                 computed.readOnly('workflow.unhandledItems'),
  selectedTag:               computed.readOnly('workflow.selectedTag'),
  messagesWithSelectedTag:   computed.readOnly('workflow.messagesWithSelectedTag'),
  selectedDate:              computed.readOnly('workflow.selectedDate'),
  messagesWithSelectedDate:  computed.readOnly('workflow.messagesWithSelectedDate'),
  matchingMessages:          computed.readOnly('workflow.matchingMessages'),
  todaysMessages:            computed.readOnly('workflow.todaysUnhandledMessages'),
  todaysMessageCount:        computed.readOnly('todaysMessages.length'),
  selectedMessage:           computed.readOnly('workflow.selectedMessage'),
  shouldShowMessagesInGroup: computed.readOnly('workflow.shouldShowMessagesInGroup'),

  actions: {
    selectDate(date) {
      this.get('workflow').selectDate(date);
    },

    selectTag(tag) {
      this.get('workflow').selectTag(tag);
    },
  }
});
