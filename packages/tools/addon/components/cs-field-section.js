import Component from '@ember/component';
import layout from '../templates/components/cs-field-section';

export default Component.extend({
  layout,
  classNames: ['cs-field-section'],

  mouseEnter(event) {
    let hovered = this.get('hovered');
    if (hovered) {
      hovered(event);
    }
  },

  mouseLeave(event) {
    let unhovered = this.get('unhovered');
    if (unhovered) {
      unhovered(event);
    }
  },

  click(event) {
    let selected = this.get('selected');
    if (selected) {
      selected(event);
    }
  }
});
