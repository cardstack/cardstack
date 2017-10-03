import { assert } from "@ember/debug"
import Message from '@cardstack/models/generated/message';
import { equal } from '@ember/object/computed';
import { A } from "@ember/array";

import { task } from 'ember-concurrency';
import { computed } from "@ember/object";

export default Message.extend({
  loadedCard: computed({
    get() {
      this.get('_loadCard').perform();
      return null;
    },
    set(k, v) {
      return v;
    }
  }),

  handle() {
    this.set('status', 'handled');
  },

  isUnhandled: equal('status', 'unhandled'),

  _loadCard: task(function * () {
    let cardType = this.get('_cardTypeInStore');
    let card = yield this.get('store').findRecord(cardType, this.get('cardId'));
    this.set('loadedCard', card);
  }),

  _cardTypeInStore: computed('cardType', function() {
    let cardType = this.get('cardType');
    assert(`${cardType} doesn't seem to be a plural noun`, cardType.charAt(cardType.length - 1) === 's');
    //TODO: Replace this make-shift singularization
    return this.get('cardType').replace(/s$/, '');
  }),

  loadedTags: computed({
    get() {
      this.get('_loadTags').perform();
      return A();
    },
    set(k, v) {
      return v;
    }
  }),

  _loadTags: task(function * () {
    let tags = yield this.get('tags');
    this.set('loadedTags', tags);
    return tags;
  }),
})
