import Ember from 'ember';

const { inject } = Ember;

export const REQUEST_TO_PUBLISH_LIVE = 'Request to publish live';
export const READY_FOR_COPYEDITING = 'Ready for copyediting';
export const COURSE_INFORMATION_SYNCED = 'Course information synced';

const categories = [
  REQUEST_TO_PUBLISH_LIVE,
  READY_FOR_COPYEDITING,
  COURSE_INFORMATION_SYNCED
];

export default Ember.Service.extend({
  notificationCount: 0,
  isOpen: false,

  store: inject.service(),

  // items: Ember.A(),
  //TODO: How can I set up the seeds to be returned at /changes?
  // items: Ember.computed(function() {
  //   return this.get('store').findAll('change');
  // }),

  items: Ember.computed(function() {
    let store = this.get('store');
    return Ember.A([
      store.createRecord('change', { category: REQUEST_TO_PUBLISH_LIVE, isHandled: false }),
      store.createRecord('change', { category: REQUEST_TO_PUBLISH_LIVE, isHandled: false }),
      store.createRecord('change', { category: REQUEST_TO_PUBLISH_LIVE, isHandled: true }),
      store.createRecord('change', { category: READY_FOR_COPYEDITING, isHandled: false }),
      store.createRecord('change', { category: READY_FOR_COPYEDITING, isHandled: true }),
      store.createRecord('change', { category: COURSE_INFORMATION_SYNCED, isHandled: true }),
      store.createRecord('change', { category: COURSE_INFORMATION_SYNCED, isHandled: true }),
    ]);
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
