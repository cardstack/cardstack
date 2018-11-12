import { not, alias } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../templates/components/cs-mode-button';

export default Component.extend({
  layout,
  classNames: ['cs-mode-button'],
  classNameBindings: ['active', 'iconOnly'],
  iconOnly: not('mode.description'),
  active: alias('mode.active'),
  click() {
    this.get('mode.makeActive')();
  },
});
