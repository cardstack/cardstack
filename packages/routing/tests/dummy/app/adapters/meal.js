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
        type: 'meal',
        id: record.data.id
      }, { branch: query.branch });
      return record;
    });
  },

  _queryRecord(query) {
    if (this._exactSlug(query) === 'burger') {
      return RSVP.resolve({
        data: {
          type: 'meals',
          id: 'burger',
          attributes: {
            title: 'Tasty Burger'
          }
        }
      });
    } else  if (this._exactSlug(query) === ' ') {
      return RSVP.resolve({
        data: {
          type: 'meals',
          id: 'special',
          attributes: {
            title: 'The Special'
          }
        }
      });
    } else {
      throw new Error("No such test data");
    }
  }
});
