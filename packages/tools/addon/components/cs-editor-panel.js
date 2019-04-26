import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-editor-panel';
import injectOptional from 'ember-inject-optional';

export default Component.extend({
  layout,
  cardstackRouting: injectOptional.service('cardstack-routing'),
  tools: service('cardstack-tools'),
  classNames: ['cardstack-tools', 'cs-editor-panel'],
  attributeBindings: ['dataTestName:data-test-cs-editor-panel'],
  dataTestName: ''
});
