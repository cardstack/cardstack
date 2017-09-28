import layout from '../templates/components/cardstack-workflow';
import Component from "@ember/component";
import { inject } from "@ember/service";
import { computed } from "@ember/object"
import { readOnly } from "@ember/object/computed";
import { workflowGroupId } from "@cardstack/workflow/helpers/workflow-group-id";

export default Component.extend({
  layout,
  classNames:  ['cardstack-workflow'],
  workflow:    inject('cardstack-workflow'),

  groupedThreads:             readOnly('workflow.groupedThreads'),
  unhandled:                  readOnly('workflow.unhandledItems'),
  threadsWithSelectedTag:     readOnly('workflow.threadsWithSelectedTag'),
  threadsWithSelectedDate:    readOnly('workflow.threadsWithSelectedDate'),
  matchingThreads:            readOnly('workflow.matchingThreads'),
  unhandledForToday:          readOnly('workflow.unhandledForToday'),
  todaysNotificationCount:    readOnly('unhandledForToday.length'),
  shouldShowMatchingThreads:  readOnly('workflow.shouldShowMatchingThreads'),

  selectedDate:               readOnly('workflow.selectedDate'),
  selectedThread:             readOnly('workflow.selectedThread'),
  selectedPriority:           readOnly('workflow.selectedPriority'),
  selectedTag:                readOnly('workflow.selectedTag'),

  selectedGroup: computed('selectedDate', 'selectedTag', 'selectedPriority', function() {
    let priority = this.get('selectedPriority');
    let date = this.get('selectedDate');
    let tag = this.get('selectedTag');
    if (date) {
      return workflowGroupId([ priority, date ]);
    }
    if (tag) {
      return workflowGroupId([ priority, tag.get('name') ]);
    }
  }),

  actions: {
    selectDate(date) {
      this.get('workflow').selectDate(date);
    },

    selectTag(tagId) {
      this.get('workflow').selectTag(tagId);
    },
  }
});
