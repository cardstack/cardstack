import Ember from 'ember';
import layout from '../templates/components/cardstack-content';

export default Ember.Component.extend({
  layout,
  format: 'card',
  specificComponent: Ember.computed('content', 'format', function() {
    let type = this.get('content.constructor.modelName');
    let format = this.get('format');
    return `cardstack/${type}-${format}`;
  })
});
