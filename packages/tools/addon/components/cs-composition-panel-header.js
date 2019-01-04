import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import layout from '../templates/components/cs-composition-panel-header';

export default Component.extend({
  layout,
  cardstackData: service(),
  tagName: 'header',
  classNames: ['cs-composition-panel-header'],
  classNameBindings: ['editingEnabled:enabled:disabled'],

  title: computed('model', function() {
    return this.cardstackData.getCardMeta(this.model, 'title');
  })
});
