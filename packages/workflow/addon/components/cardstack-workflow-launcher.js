import { inject as service } from '@ember/service';
import { readOnly } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-workflow-launcher';

export default Component.extend({
  layout,
  tagName: '',
  classNames: ['cardstack-workflow-launcher'],
  workflow: service('cardstack-workflow'),
  notificationCount: readOnly('workflow.notificationCount'),
});
