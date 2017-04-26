import Ember from 'ember';
import layout from '../templates/components/cs-admin-launcher';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-admin-launcher'],
  menuOpen: false,
  click() {
    this.set('menuOpen', !this.get('menuOpen'));
  }
});
