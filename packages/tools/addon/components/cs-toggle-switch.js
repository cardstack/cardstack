import Component from '@ember/component';
import layout from '../templates/components/cs-toggle-switch';

export default Component.extend({
  layout,
  classNames: ['cs-toggle-switch'],
  classNameBindings: ['enabled::disabled'],
  enabled: true,
  click() {
    if (this.get('enabled')) {
      this.get('change')(!this.get('value'));
    }
  }
});
