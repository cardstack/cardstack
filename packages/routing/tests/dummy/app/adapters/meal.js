import DS from 'ember-data';
import RSVP from 'rsvp';

export default DS.JSONAPIAdapter.extend({
  _exactSlug(query) {
    return query.filter && query.filter.slug && query.filter.slug.exact;
  },

  queryRecord(store, type, query) {
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
