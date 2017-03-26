import DS from 'ember-data';
import RSVP from 'rsvp';
import Ember from 'ember';

export default DS.JSONAPIAdapter.extend({
  resourceMetadata: Ember.inject.service(),

  _exactSlug(query) {
    return query.filter && query.filter.slug && query.filter.slug.exact;
  },

  queryRecord(store, type, query) {
    return this._queryRecord(query).then(record => {
      this.get('resourceMetadata').write({
        type: 'beverage',
        id: record.data.id
      }, { branch: query.branch });
      return record;
    });
  },

  _queryRecord(query) {
    if (this._exactSlug(query) === 'soda') {
      return RSVP.resolve({
        data: {
          type: 'beverages',
          id: 'burger',
          attributes: {
            title: 'Coca Cola'
          }
        }
      });
    } else {
      throw new Error("No such test data");
    }
  }
});
