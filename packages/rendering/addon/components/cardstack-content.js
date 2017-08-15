import Ember from 'ember';
import layout from '../templates/components/cardstack-content';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';

export default Ember.Component.extend({
  layout,
  format: 'card',
  tagName: '',
  id: Ember.computed('content', 'format', function() {
    return `${Ember.guidFor(this.get('content'))}/${this.get('format')}`;
  }),
  specificComponent: Ember.computed('content', 'format', function() {
    let format = this.get('format');
    if (this.get('content.isCardstackPlaceholder')) {
      return `cardstack/cardstack-placeholder-${format}`;
    }
    let type = modelType(this.get('content'));
    return `cardstack/${type}-${format}`;
  })
});
