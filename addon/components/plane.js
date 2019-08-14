import Component from '@ember/component';
import layout from '../templates/components/plane';
import { inject as service } from '@ember/service';

export default Component.extend({
  layout,
  tagName: '',
  boxel: service(),

  init() {
    this._super(...arguments);

    this.boxel.registerPlane(this);
  }
});
