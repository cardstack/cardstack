import { guidFor } from '@ember/object/internals';
import { computed } from '@ember/object';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-content';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';

export default Component.extend({
  layout,
  format: 'card',
  tagName: '',
  id: computed('content', 'format', function() {
    return `${guidFor(this.get('content'))}/${this.get('format')}`;
  }),
  specificComponent: computed('content', 'format', function() {
    let format = this.get('format');
    if (this.get('content.isCardstackPlaceholder')) {
      return `cardstack/cardstack-placeholder-${format}`;
    }
    let type = modelType(this.get('content'));
    return `cardstack/${type}-${format}`;
  })
});
