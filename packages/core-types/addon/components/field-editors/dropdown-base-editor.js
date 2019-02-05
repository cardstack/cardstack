import Component from '@ember/component';
import { dasherize } from '@ember/string';
import { singularize } from 'ember-inflector';
import { inject as service } from '@ember/service';
import { task, timeout } from 'ember-concurrency';
import { get, getWithDefault, set, computed } from '@ember/object';
// @TODO: expose public api
import metaForField from '@cardstack/rendering/-private/meta-for-field';

const { readOnly } = computed;

export default Component.extend({
  store: service(),
  cardstackEdges: service(),
  init() {
    this._super();

    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('dropdown-container');
  },

  matchBy: readOnly('editorOptions.matchBy'),

  displayFieldName: computed('editorOptions.displayFieldName', function() {
    return getWithDefault(this, 'editorOptions.displayFieldName', 'title');
  }),

  loadOptions: task(function*() {
    let store = get(this, 'store');
    let content = get(this, 'content');
    let field = get(this, 'field');
    let meta = metaForField(content, field);
    let contentType = (meta && meta.type) ? meta.type : singularize(dasherize(field));

    let options;
    try {
      options = yield store.findAll(contentType);
    } catch(e) {
      set(this, 'missingContentType', true);
    }

    set(this, 'options', options);
  }),

  searchFields: task(function * (value) {
    yield timeout(300);

    let store = get(this, 'store');
    let content = get(this, 'content');
    let field = get(this, 'field');
    let meta = metaForField(content, field);
    let contentType = (meta && meta.type) ? meta.type : dasherize(field);

    let query = {
      filter: {}
    }

    let displayFieldName = get(this, 'displayFieldName');

    switch(get(this, 'matchBy')) {
      case 'exact':
        query.filter[displayFieldName] = { exact: value };
        break;
      case 'prefix':
        query.filter[displayFieldName] = { prefix: value };
        break;
      case 'words':
      default:
        query.filter[displayFieldName] = value;
    }

    return store.query(contentType, query);
  }),

  actions: {
    makeSelection(option) {
      let field = get(this, 'field');
      let content = get(this, 'content');

      content.watchRelationship(field, () => {
        set(content, field, option);
      })
    }
  }
});
