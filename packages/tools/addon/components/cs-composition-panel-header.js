import Component from '@ember/component';
import layout from '../templates/components/cs-composition-panel-header';

export default Component.extend({
  layout,
  tagName: 'header',
  classNames: ['cs-composition-panel-header'],
  classNameBindings: ['editingEnabled:enabled:disabled']
});
