import Component from '@ember/component';
import layout from '../templates/components/cardstack-edges';
import { inject as service } from '@ember/service';

export default Component.extend({
  cardstackEdges: service(),
  topRightCornerBelongsTo: "right",
  layout,
  tagName: ''
});
