import Component from '@ember/component';
import { dasherize } from '@ember/string';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import layout from '../../templates/components/field-editors/dropdown-choices-editor';
import { get, getWithDefault, set, computed } from '@ember/object';
// @TODO: expose public api
import metaForField from '@cardstack/rendering/-private/meta-for-field';


export default Component.extend({
  layout,
  store: service(),

  displayFieldName: computed('editorOptions.displayFieldName', function() {
    return getWithDefault(this, 'editorOptions.displayFieldName', 'title');
  }),

  loadOptions: task(function*() {
    let store = get(this, 'store');
    let content = get(this, 'content');
    let field = get(this, 'field');
    let meta = metaForField(content, field);
    let contentType = (meta && meta.type) ? meta.type : dasherize(field);

    let options;
    try {
      options = yield store.findAll(contentType);
    } catch(e) {
      set(this, 'missingContentType', true);
    }

    set(this, 'options', options);
  }).on('init'),

  actions: {
    makeSelection(option) {
      let field = get(this, 'field');
      let content = get(this, 'content');

      set(content, field, option);
    }
  }
});