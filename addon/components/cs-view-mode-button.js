import Ember from 'ember';
import layout from '../templates/components/cs-view-mode-button';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-view-mode-button'],
  classNameBindings: ['active'],
  active: Ember.computed('mode', 'currentMode', function() {
    return this.get('mode') === this.get('currentMode');
  }),
  iconWidth: Ember.computed('mode', function() {
    return this.get('mode') === 'cards' ? 20 : 18;
  }),
  description: Ember.computed('mode', function() {
    return this.get('mode') === 'cards' ? 'Tile' : 'Page';
  }),
  icon: Ember.computed('mode', function() {
    return this.get('mode') === 'cards' ? 'tiles' : 'page';
  }),
  click() {
    this.get('setMode')(this.get('mode'));
  }
});
