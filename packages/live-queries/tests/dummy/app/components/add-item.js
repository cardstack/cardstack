import Component from '@ember/component';
import { inject as service } from '@ember/service';

export default Component.extend({
  store: service(),
  addContent() {
    let content = this.get('newContent');
    this.set('newContent', '');
    this.get('store').createRecord('item', {content}).save();
  }
});
