import Component from '@ember/component';
import { inject } from '@ember/service';

export default Component.extend({
  store: inject(),

  actions: {
    addCategory() {
      let category = this.store.createRecord('category');
      this.content.watchRelationship('categories', () => {
        this.content.categories.pushObject(category);
      });
    }
  }
})
