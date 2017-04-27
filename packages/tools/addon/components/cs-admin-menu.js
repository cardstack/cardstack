import Ember from 'ember';
import layout from '../templates/components/cs-admin-menu';
import swapOut from 'ember-toolbars/transitions/swap-out';

const duration = 500;

export default Ember.Component.extend({
  layout,
  flyout,
  classNames: ['cs-admin-menu', 'cardstack-tools'],
  activePanel: null,
  actions: {
    openPlugins() {
      this.set('activePanel', 'cs-plugins-panel');
    },
    openDataSources() {
      this.set('activePanel', 'cs-data-sources-panel');
    }
  }
});



function flyout() {
  this.transition(
    this.fromValue(true),
    this.toValue(true),
    this.use(swapOut, 'x', 1, { duration })
  );
  this.transition(
    this.fromValue(false),
    this.toValue(true),
    this.use('to-right', { duration }),
    this.reverse('to-left', { duration })
  );
}
