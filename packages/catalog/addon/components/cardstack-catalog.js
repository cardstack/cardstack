import Component from '@ember/component';
import flatten from 'lodash/flatten';
import { singularize } from 'ember-inflector';
import { inject } from '@ember/service';
import layout from '../templates/cardstack-catalog';

const MAX_CONTENT_TYPES = 1000;

export default Component.extend({
  layout,
  store: inject(),
  cardstackData: inject(),
  isComponent: inject(),

  didReceiveAttrs() {
    this.loadCards();
  },

  async loadCards() {
    let contentTypes = await this.store.query('content-type', {
      filter: {
        // FIXME: our non-built-in content types should have `is-built-in:
        // false`, but right now they just don't have that attribute at all,
        // so instead of querying for false we query for nonexistence.
        "is-built-in": { exists: false }
      },
      page: {
        size: MAX_CONTENT_TYPES
      }
    })
    let types = contentTypes.map(type => singularize(type.id));
    types = types.filter(type => this.isComponent.test(`cardstack/${type}-embedded`));
    let cardLists = await Promise.all(types.map(type => this.cardstackData.query('embedded', { type, page: { size: 1000 } })));
    let cards = flatten(cardLists.map(list => list.toArray()));
    this.set('cards', cards);
  }
});
