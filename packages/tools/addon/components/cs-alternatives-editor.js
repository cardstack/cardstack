import Component from '@ember/component';
import { get, set } from '@ember/object';
import layout from '../templates/components/cs-alternatives-editor';

export default Component.extend({
  layout,
  actions: {
    switchAlternative(current, target, transitionToTab) {
      // Clear current alternative's fields
      let currentAlternative = this.get('alternatives').findBy('name', current);
      let content = this.get('content');
      get(currentAlternative, 'fieldNames').forEach((fieldName) => {
        set(content, fieldName, '');
      });

      transitionToTab(target);
    }
  }
});
