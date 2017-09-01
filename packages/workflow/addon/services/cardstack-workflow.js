import Ember from 'ember';

const { inject, computed } = Ember;

export const REQUEST_TO_PUBLISH_LIVE = 'Request to publish live';
export const READY_FOR_COPYEDITING = 'Ready for copyediting';
export const COURSE_INFORMATION_SYNCED = 'Course information synced';

export const NEED_RESPONSE = 'Need Response';
export const AUTO_PROCESSED = 'Automatically Processed';
export const FYI = 'For Your Information';

// const priorities = [
//   NEED_RESPONSE,
//   AUTO_PROCESSED,
//   FYI
// ]
// const tags = [
//   REQUEST_TO_PUBLISH_LIVE,
//   READY_FOR_COPYEDITING,
//   COURSE_INFORMATION_SYNCED
// ];

export default Ember.Service.extend({
  isOpen: false,

  store: inject.service(),

  items: computed(function() {
    return this.get('store').findAll('message');
  }),

  unhandledItems:    computed.filterBy('items', 'isHandled', false),
  notificationCount: computed.readOnly('unhandledItems.length'),

  messagesByTag: computed('items.@each.{isHandled,tag}', function() {
    return this.get('items').reduce((messages, message) => {
      let tag = Ember.get(message, 'tag');
      if (!messages[tag]) {
        messages[tag] = 0;
      }
      messages[tag] += Ember.get(message, 'isHandled') ? 0 : 1;
      return messages;
    }, {});
  }),
});
