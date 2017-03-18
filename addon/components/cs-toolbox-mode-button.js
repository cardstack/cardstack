import Ember from 'ember';
import layout from '../templates/components/cs-toolbox-mode-button';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-toolbox-mode-button'],
  click() {
    this.get('setMode')(this.get('mode'));
  }
});
