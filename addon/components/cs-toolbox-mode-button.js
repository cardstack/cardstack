import Ember from 'ember';
import layout from '../templates/components/cs-toolbox-mode-button';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-toolbox-mode-button'],
  classNameBindings: ['active', 'iconOnly'],
  iconOnly: Ember.computed.not('mode.description'),
  active: Ember.computed.alias('mode.active'),
  click() {
    this.get('mode.makeActive')();
  }
});
