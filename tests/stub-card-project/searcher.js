const { get, uniqBy } = require('lodash');
module.exports = class StubCardSearcher {
  static create(params) {
    return new this(params);
  }

  constructor(params) {
    this.cards = params.cardSearchResults || [];
    this.cardIds = this.cards.map(i => i.data.id);
  }

  async get(session, type, id, next) {
    if (type === id && id.split('::').length === 2 && this.cardIds.includes(id)) {
      return this.cards.find(i => i.data.id === id);
    }
    return await next();
  }

  async search(session, query, next) {
    if (get(query, 'filter.type.exact') === 'cards') {
      let id = get(query, 'filter.id.exact');
      let included = [];
      let data = [];
      if (id != null) {
        let result = this.cards.find(i => i.data.id === id);
        if (!result) {
          return { data, included };
        } else {
          return { data: [result.data], included: result.included };
        }
      }
      for (let card of this.cards) {
        data.push(card.data);
        included = included.concat(card.included);
      }
      included = uniqBy(included, i => `${i.type}/${i.id}`);

      return { data, included };
    }
    return next();
  }
};
