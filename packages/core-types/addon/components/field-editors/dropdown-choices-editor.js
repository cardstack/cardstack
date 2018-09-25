import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import layout from '../../templates/components/field-editors/dropdown-choices-editor';
import { get, getWithDefault, set, computed } from '@ember/object';

export default Component.extend({
  layout,
  store: service(),

  displayFieldName: computed('editorOptions.displayFieldName', function() {
    return getWithDefault(this, 'editorOptions.displayFieldName', 'title');
  }),

  loadOptions: task(function*() {
    let store = get(this, 'store');
    let field = get(this, 'field');

    let options = yield store.findAll(field);

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