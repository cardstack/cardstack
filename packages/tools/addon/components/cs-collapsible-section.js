import Component from '@ember/component';
import layout from '../templates/components/cs-collapsible-section';

export default Component.extend({
  layout,
  tagName: 'section',
  classNames: ['cs-collapsible-section'],
  attributeBindings: ['dataTestName:data-test-cs-collapsible-section'],
  dataTestName: '',

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
