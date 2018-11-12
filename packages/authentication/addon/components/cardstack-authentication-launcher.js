import layout from '../templates/components/cardstack-authentication-launcher';
import Component from '@ember/component';

export default Component.extend({
  layout,
  classNames: ['cardstack-authentication'],
  classNameBindings: ['isOpen:open'],
  toggleOpen() {
    this.toggleProperty('isOpen');
  },
});
