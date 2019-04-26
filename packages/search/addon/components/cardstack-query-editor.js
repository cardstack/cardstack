import { assign } from '@ember/polyfills';
import { computed } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-query-editor';

export default Component.extend({
  layout,
  classNames: ['cs-query-editor'],
  placeholder: 'Search Library',

  internalQuery: computed('searchTerm', 'searchType', 'searchFields.[]', function() {
    let searchTerm = this.get('searchTerm');
    if (!searchTerm ) { return {}; }

    let searchFields = this.get('searchFields');
    if (!searchFields || !searchFields.length) {
      return { q: searchTerm };
    }

    let searchType = this.get('searchType');
    let query = {
      filter: {
        or: searchFields.map(field => {
          if (searchType) {
            return {
              [field]: { [searchType]: searchTerm }
            };
          } else {
            return { [field]: searchTerm };
          }
        })
      }
    };

    return query;
  }),

  actions: {
    clear() {
      this.set('searchTerm', '');
      this.get("update")({});
    },
    update() {
      this.get("update")(assign({}, this.get("internalQuery")));
    }
  }
});
