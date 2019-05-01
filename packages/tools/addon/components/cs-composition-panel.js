import Component from '@ember/component';
import layout from '../templates/components/cs-composition-panel';

export default Component.extend({
  layout,
  tagName: '',
  actions: {
    openField(which) {
      return this.get('tools').openField(which);
    },
    highlightField(which) {
      return this.get('tools').highlightField(which);
    },
    detailField(which) {
      return this.get('tools').detailField(which);
    }
  }
});
