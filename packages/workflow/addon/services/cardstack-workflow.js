import Ember from 'ember';

const { inject } = Ember;

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
// const categories = [
//   REQUEST_TO_PUBLISH_LIVE,
//   READY_FOR_COPYEDITING,
//   COURSE_INFORMATION_SYNCED
// ];

export default Ember.Service.extend({
  isOpen: false,

  store: inject.service(),

  items: Ember.computed(function() {
    return this.get('store').findAll('change');
  }),

  notificationCount: Ember.computed('items.@each.isHandled', function() {
    return this.get('items').filterBy('isHandled', false).length;
  }),

  changesByCategory: Ember.computed('items.@each.{isHandled,category}', function() {
    return this.get('items').reduce((changes, change) => {
      let category = Ember.get(change, 'category');
      if (!changes[category]) {
        changes[category] = 0;
      }
      changes[category] += Ember.get(change, 'isHandled') ? 0 : 1;
      return changes;
    }, {});
  }),
});
