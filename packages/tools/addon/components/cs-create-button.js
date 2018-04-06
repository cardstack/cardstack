import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-create-button';

export default Component.extend({
  layout,
  tagName: '',
  tools: service('cardstack-tools'),
  actions: {
    create() {
      this.get('tools').setActivePanel('cs-create-menu');
    }
  }
});
