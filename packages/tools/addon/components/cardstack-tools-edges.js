import Component from '@ember/component';
import { inject as service } from "@ember/service";
import layout from '../templates/components/cardstack-tools-edges';

export default Component.extend({
  tools: service('cardstack-tools'),
  layout
});
