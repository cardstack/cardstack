import Ember from 'ember';
import layout from '../templates/components/cs-mode-button';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-mode-button'],
  classNameBindings: ['active', 'iconOnly'],
  iconOnly: Ember.computed.not('mode.description'),
  active: Ember.computed.alias('mode.active'),
  click() {
    this.get('mode.makeActive')();
  }
});
