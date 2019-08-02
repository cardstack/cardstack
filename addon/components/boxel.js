import Component from '@ember/component';
import { computed } from '@ember/object';
import layout from '../templates/components/boxel';

const { readOnly } = computed;
export default Component.extend({
  layout,
  tagName: '',

  contentType: readOnly('content.constructor.modelName')
});
