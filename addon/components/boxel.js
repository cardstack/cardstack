import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import layout from '../templates/components/boxel';

const { readOnly } = computed;
export default Component.extend({
  layout,
  tagName: '',
  boxel: service(),

  contentType: readOnly('content.constructor.modelName'),

  init() {
    this._super(...arguments);

    this.boxel.registerBoxel(this);
  },

  name: computed('elementId', function() {
    return `boxel-${this.elementId}`;
  }),

  clickAction() {},

  actions: {
    moveToPlane(planeId) {
      this.set('plane', planeId);
    }
  }
});
