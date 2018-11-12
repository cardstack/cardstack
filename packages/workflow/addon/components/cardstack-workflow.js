import layout from '../templates/components/cardstack-workflow';
import Component from '@ember/component';
import { inject } from '@ember/service';
import { computed } from '@ember/object';
import { readOnly, or } from '@ember/object/computed';
import { workflowGroupId } from '@cardstack/workflow/helpers/workflow-group-id';

export default Component.extend({
  layout,
  tagName: '',
  classNames: ['cardstack-workflow'],

  workflow: inject('cardstack-workflow'),
  store: inject(),

  isOpen: false,

  threads: readOnly('workflow.items'),
  groupedThreads: readOnly('workflow.groupedThreads'),
  unhandled: readOnly('workflow.unhandledItems'),
  unhandledForToday: readOnly('workflow.unhandledForToday'),
  todaysNotificationCount: readOnly('unhandledForToday.length'),
  threadsUpdatedToday: readOnly('workflow.threadsUpdatedToday'),

  selectedDate: '',
  selectedPriority: '',
  selectedTag: null,

  selectedGroup: computed('selectedDate', 'selectedTag', 'selectedPriority', function() {
    let priority = this.get('selectedPriority');
    let date = this.get('selectedDate');
    let tag = this.get('selectedTag');
    if (date) {
      return workflowGroupId([priority, date]);
    }
    if (tag) {
      return workflowGroupId([priority, tag.get('name')]);
    }
  }),

  threadsWithSelectedDate: computed('selectedDate', function() {
    if (this.get('selectedDate') === 'today') {
      let threads = this.get('threadsUpdatedToday');
      return {
        today: {
          name: 'Today',
          threads,
        },
      };
    }
    return {};
  }),

  shouldShowMatchingThreads: or('selectedTag', 'selectedDate'),

  matchingThreads: computed(
    'selectedTag',
    'selectedDate',
    'threadsWithSelectedTag',
    'threadsWithSelectedDate',
    function() {
      if (this.get('selectedTag')) {
        return this.get('threadsWithSelectedTag');
      }
      if (this.get('selectedDate')) {
        return this.get('threadsWithSelectedDate');
      }
      return [];
    },
  ),

  threadsWithSelectedTag: computed('threads.@each.{tagIds,priority}', 'selectedTag', function() {
    let selectedTagId = this.get('selectedTag.id');
    let withSelectedTag = this.get('threads').filter(thread => thread.get('tagIds').includes(selectedTagId));
    return withSelectedTag.reduce((groups, thread) => {
      let priority = thread.get('priority');
      let priorityId = priority.get('id');
      if (!groups[priorityId]) {
        groups[priorityId] = {
          name: priority.get('name'),
          threads: [],
        };
      }

      groups[priorityId].threads.push(thread);
      return groups;
    }, {});
  }),

  clearSelectedThread() {
    this.set('selectedThread', null);
  },

  actions: {
    toggleOpen() {
      this.toggleProperty('isOpen');

      let toggleOpen = this.get('toggleOpen');
      if (typeof toggleOpen === 'function') {
        toggleOpen();
      }
    },

    selectThread(thread) {
      //TODO: Close the notification panel, or at least the CCLV
      let selectThread = this.get('workflow').selectThread;
      if (typeof selectThread === 'function') {
        this.get('workflow').selectThread(thread);
      } else {
        this.set('selectedThread', thread);
      }
      this.setProperties({
        selectedDate: null,
        selectedTag: null,
      });
    },

    selectDate(date) {
      this.setProperties({
        selectedDate: date,
        selectedTag: null,
      });
      this.clearSelectedThread();
    },

    selectTag({ priority, tagId }) {
      this.set('selectedPriority', priority);
      let selectedTag = this.get('store').peekRecord('tag', tagId);
      this.setProperties({
        selectedDate: null,
        selectedTag,
      });
      this.clearSelectedThread();
    },
  },
});
