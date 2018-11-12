import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-toolbox';
import injectOptional from 'ember-inject-optional';

export default Component.extend({
  layout,
  classNames: ['cardstack-toolbox', 'cardstack-tools', 'cardstack-toolbox-width'],
  cardstackRouting: injectOptional.service('cardstack-routing'),
  tools: service('cardstack-tools'),
});
