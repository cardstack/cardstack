import Component from '@ember/component';
import layout from '../templates/components/cs-collapsible-section';

export default Component.extend({
  layout,
  tagName: 'section',
  classNameBindings: ['opened:opened:closed'],
  animationRules,

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

  actions: {
    toggle() {
      if (this.get('opened')) {
        this.get('close')();
      } else {
        this.get('open')();
      }
    }
  }
});

function animationRules() {
  this.transition(
    this.fromValue(false),
    this.toValue(true),
    this.use('to-down', { duration: 250 }),
    this.reverse('to-up', { duration: 250 })
  );
}
