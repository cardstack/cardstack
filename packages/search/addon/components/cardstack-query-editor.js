import { assign } from '@ember/polyfills';
import { computed } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-query-editor';

export default Component.extend({
  layout,
  internalQuery: computed('query', function() {
    return this.get('query') || {};
  }),
  actions: {
    update() {
      this.get("update")(assign({}, this.get("internalQuery")));
    }
  }
});
