import Ember from 'ember';
import layout from '../templates/components/cardstack-content';
import { modelType } from '@cardstack/tools/helpers/cs-model-type';

export default Ember.Component.extend({
  layout,
  format: 'card',
  tagName: '',
  id: Ember.computed('content', 'format', function() {
    return `${Ember.guidFor(this.get('content'))}/${this.get('format')}`;
  }),
  specificComponent: Ember.computed('content', 'format', function() {
    let type = modelType(this.get('content'));
    let format = this.get('format');
    return `cardstack/${type}-${format}`;
  })
});
