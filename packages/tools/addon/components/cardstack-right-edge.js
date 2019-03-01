import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-right-edge';
import injectOptional from 'ember-inject-optional';

export default Component.extend({
  layout,
  tagName: '',
  cardstackRouting: injectOptional.service('cardstack-routing'),
  tools: service('cardstack-tools')
});
