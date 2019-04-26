import Component from '@ember/component';
import layout from '../templates/components/mark-overlay-unless-hidden';

export default Component.extend({
  layout,
  tagName: '',

  id: null,
  model: null,
  group: null,
  hide: false,
});
