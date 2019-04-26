import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-tools-launcher';

export default Component.extend({
  tools: service('cardstack-tools'),
  classNames: ['cardstack-tools'],
  layout,
  toolsAvailable: alias('tools.available'), // user is authenticated and has access to tools
  active: alias('tools.active'), // edges are in active state

  actions: {
    setActive(isActive) {
      this.get('tools').setEditing(isActive);
      this.get('tools').setActive(isActive);
    },
    toggleActive() {
      this.get('tools').setEditing(!this.active);
      this.get('tools').setActive(!this.active);
    }
  }
});
