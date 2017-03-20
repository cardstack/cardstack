import Ember from 'ember';
import layout from '../templates/components/cs-composition-panel';

export default Ember.Component.extend({
  layout,
  actions: {
    openField(which) {
      return this.get('tools').openField(which);
    },
    highlightField(which) {
      return this.get('tools').highlightField(which);
    }
  }
});
