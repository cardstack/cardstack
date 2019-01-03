import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';
import layout from '../templates/components/cs-composition-panel-header';

export default Component.extend({
  layout,
  cardstackData: service(),
  tagName: 'header',
  classNames: ['cs-composition-panel-header'],
  classNameBindings: ['editingEnabled:enabled:disabled'],

  getModelTitle: task(function * () {
    let card = this.model;
    let title = yield this.cardstackData.getCardMeta(card, 'title');
    this.set('title', title || '');
  }).on('init'),
});
