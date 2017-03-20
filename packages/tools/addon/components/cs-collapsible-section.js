import Ember from 'ember';
import layout from '../templates/components/cs-collapsible-section';

export default Ember.Component.extend({
  layout,
  tagName: 'section',
  classNameBindings: ['opened:opened:closed'],

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
