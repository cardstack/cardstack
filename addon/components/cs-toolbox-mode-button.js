import Ember from 'ember';
import layout from '../templates/components/cs-toolbox-mode-button';

export default Ember.Component.extend({
  layout,
  classNames: ['cs-toolbox-mode-button'],
  classNameBindings: ['active'],
  active: Ember.computed('mode', 'currentMode', function() {
    return this.get('mode') === this.get('currentMode');
  }),

  icons:     {
    'cardstack-toolbox': {
      name: 'write',
      width: 13,
      height: 18
    },
    'cardstack-library': {
      name: 'archive',
      width: 22,
      height: 24
    }
  },

  icon: Ember.computed('mode', function() {
    return this.get('icons')[this.get('mode')];
  }),

  click() {
    this.get('setMode')(this.get('mode'));
  }
});
