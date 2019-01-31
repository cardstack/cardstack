import Component from '@ember/component';
import { computed } from '@ember/object';

export default Component.extend({
  categoryNames: computed('value.@each.name', function() {
    return this.value.map((category) => category.name)
      .join(',');
  })
})
