import Component from '@ember/component';
import layout from '../templates/components/cs-admin-launcher';

export default Component.extend({
  layout,
  classNames: ['cs-admin-launcher'],
  menuOpen: false,
  click() {
    this.set('menuOpen', !this.get('menuOpen'));
  }
});
