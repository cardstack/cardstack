import Component from '@ember/component';
import { dasherize } from '@ember/string';
import { inject as service } from '@ember/service';
import layout from '../../templates/components/field-editors/dropdown-search-editor';
import { get, getWithDefault, set, computed } from '@ember/object';
// @TODO: expose public api
import metaForField from '@cardstack/rendering/-private/meta-for-field';


export default Component.extend({
  layout,
  tagName: '',
  store: service(),
  cardstackEdges: service(),
  init() {
    this._super();

    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('dropdown-container');
  },

  displayFieldName: computed('editorOptions.displayFieldName', function() {
    return getWithDefault(this, 'editorOptions.displayFieldName', 'title');
  }),

  actions: {
    makeSelection(option) {
      let field = get(this, 'field');
      let content = get(this, 'content');

      content.watchRelationship(field, () => {
        set(content, field, option);
      })
    },

    searchFields(value) {
      let store = get(this, 'store');
      let content = get(this, 'content');
      let field = get(this, 'field');
      let meta = metaForField(content, field);
      let contentType = (meta && meta.type) ? meta.type : dasherize(field);

      let query = {
        filter: {}
      }

      query.filter[this.get('displayFieldName')] = value;

      return store.query(contentType, query);
    }
  }
});