import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-tools';

export default Component.extend({
  layout,
  tagName: "",
  tools: service('cardstack-tools')
});
