import Ember from 'ember';
import layout from '../templates/components/cs-composition-panel';

export default Ember.Component.extend({
  layout,

  // tools.fields is always updated via whole-array replacement, so no
  // deeper observation is needed here.
  fields: Ember.computed('tools.fields', 'tools.activeContentItem', function() {
    let item = this.get('tools.activeContentItem');
    if (item) {
      let content = item.content;
      return this.get('tools.fields').filter(f => f.content === content);
    } else {
      return [];
    }
  }),

  actions: {
    openField(which) {
      return this.get('tools').openField(which);
    },
    highlightField(which) {
      return this.get('tools').highlightField(which);
    }
  }
});
