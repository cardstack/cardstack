import Component from '@ember/component';
import { computed } from '@ember/object';

export default Component.extend({
  groups: computed(function() {
    return [];
  }),
  selectedGroup: null,
  priority: '',
  onSelect: null,
});
