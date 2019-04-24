import Component from '@ember/component';
import { inject as service } from '@ember/service';
import layout from '../templates/components/cs-header';

export default Component.extend({
  tools: service('cardstack-tools'),
  classNames: ['cardstack-tools', 'cs-header'],
  layout,
  attributeBindings: ['dataTestName:data-test-cs-header'],
  dataTestName: ''
});
