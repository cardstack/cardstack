import Ember from 'ember';
import layout from '../templates/components/cardstack-workflow';

const { inject, computed } = Ember;

export default Ember.Component.extend({
  layout,
  classNames:  ['cardstack-workflow'],
  workflow:    inject.service('cardstack-workflow'),

  groupedMessages:  computed.readOnly('workflow.groupedMessages'),
  unhandled:        computed.readOnly('workflow.unhandledItems'),

  selectedTag:    '',
  messagesWithSelectedTag: computed('unhandled.@each.tag', 'selectedTag', function() {
    return this.get('unhandled').filterBy('tag', this.get('selectedTag'));
  }),

  selectedDate: '',
  messagesWithSelectedDate: computed('selectedDate', function() {
    if (this.get('selectedDate') === 'today') {
      return this.get('todaysMessages');
    }
  }),

  matchingMessages: computed('selectedTag', 'selectedDate', function() {
    if (this.get('selectedTag')) {
      return this.get('messagesWithSelectedTag');
    }
    if (this.get('selectedDate')) {
      return this.get('messagesWithSelectedDate');
    }
  }),

  todaysMessages:  computed.readOnly('workflow.todaysUnhandledMessages'),
  todaysMessageCount: computed.readOnly('todaysMessages.length'),

  selectedMessage: computed.readOnly('workflow.selectedMessage'),

  actions: {
    selectDate(date) {
      this.setProperties({
        selectedDate: date,
        selectedTag: null
      });
      this.get('workflow').clearSelectedMessage();
    },

    selectTag(tag) {
      this.setProperties({
        selectedDate: null,
        selectedTag: tag
      });
      this.get('workflow').clearSelectedMessage();
    }
  }
});
