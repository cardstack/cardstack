import Component from '@ember/component';
import layout from '../templates/components/tray';

export default Component.extend({
  layout,
  tagName: '',

  trayAction() {},

  actions: {
    isolate() {
      this.set('expanded', true);
    }
  }
});
