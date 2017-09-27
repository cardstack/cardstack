import layout from '../templates/components/cardstack-workflow';
import Component from "@ember/component";
import { inject } from "@ember/service";
import { readOnly } from "@ember/object/computed";

export default Component.extend({
  layout,
  classNames:  ['cardstack-workflow'],
  workflow:    inject('cardstack-workflow'),

  groupedThreads:             readOnly('workflow.groupedThreads'),
  unhandled:                  readOnly('workflow.unhandledItems'),
  selectedThread:             readOnly('workflow.selectedThread'),
  threadsWithSelectedTag:     readOnly('workflow.threadsWithSelectedTag'),
  selectedDate:               readOnly('workflow.selectedDate'),
  threadsWithSelectedDate:    readOnly('workflow.threadsWithSelectedDate'),
  matchingThreads:            readOnly('workflow.matchingThreads'),
  unhandledForToday:          readOnly('workflow.unhandledForToday'),
  todaysNotificationCount:    readOnly('unhandledForToday.length'),
  selectedMessage:            readOnly('workflow.selectedMessage'),
  shouldShowMatchingThreads:  readOnly('workflow.shouldShowMatchingThreads'),

  actions: {
    selectDate(date) {
      this.get('workflow').selectDate(date);
    },

    selectTag(tagId) {
      this.get('workflow').selectTag(tagId);
    },
  }
});
