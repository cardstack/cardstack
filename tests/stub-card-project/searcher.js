const { uniqBy } = require('lodash');
module.exports = class StubCardSearcher {
  static create(params) {
    return new this(params);
  }

  constructor(params) {
    this.cards = params.cardSearchResults;
    this.cardIds = this.cards ? this.cards.map(i => i.data.id) : [];
  }

  async get(session, type, id, next) {
    if (!this.cards || !this.cards.length) { return next(); }

    if (type === 'cards' && this.cardIds.includes(id)) {
      return this.cards.find(i => i.data.id === id);
    }
    return await next();
  }

  async search(session, query, next) {
    if (!this.cards || !this.cards.length) { return next(); }

    if (query && query.filter && (query.filter.type === 'cards' || query.filter.type.exact === 'cards')) {
      let included = [];
      let data = [];
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