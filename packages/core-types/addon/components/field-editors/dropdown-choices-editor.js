import Component from '@ember/component';
import { inject as service } from '@ember/service';
import layout from '../../templates/components/field-editors/dropdown-choices-editor';
import { singularize } from 'ember-inflector';

export default Component.extend({
  layout,
  store: service(),

  didReceiveAttrs() {
    let field = this.get('field');

    return this.get('store').findAll(singularize(field)).then((types) => {
      if (!this.isDestroyed) {
        this.set('options', types);
      }
    });
  },

  actions: {
    makeSelection(option) {
      let field = this.get('field');

      this.get('content').set(field, option);
    }
  }
});