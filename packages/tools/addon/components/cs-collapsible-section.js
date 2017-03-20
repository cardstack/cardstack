import Ember from 'ember';
import layout from '../templates/components/cs-collapsible-section';

export default Ember.Component.extend({
  layout,
  tagName: 'section',
  classNameBindings: ['opened:opened:closed'],
  animationRules,

  mouseEnter(event) {
    this.sendAction('hovered', event);
  },
  mouseLeave(event) {
    this.sendAction('unhovered', event);
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
