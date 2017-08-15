import DS from 'ember-data';
import RSVP from 'rsvp';

export default DS.JSONAPIAdapter.extend({
  _exactSlug(query) {
    return query.filter && query.filter.slug && query.filter.slug.exact;
  },

  queryRecord(store, type, query) {
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
      return RSVP.reject(new DS.AdapterError([{code: 404}]));
    }
  }
});
