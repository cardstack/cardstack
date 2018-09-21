import Component from '@ember/component';
import { inject as service } from '@ember/service';

import layout from '../templates/components/card-picker-edges';

export default Component.extend({
  tools: service('cardstack-card-picker'),
  layout
});
