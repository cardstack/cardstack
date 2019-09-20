module.exports = class FakeIndexer {
  static create(params) {
    let obj = new this();
    Object.assign(obj, params);
    return obj;
  }

  async beginUpdate() {
    return new Updater(this.changedCards);
  }
};

class Updater {
  constructor(changedCards) {
    this.changedCards = changedCards || [];
  }
  async schema() {
    return [];
  }

  async updateContent(meta, hints, ops) {
    for (let card of this.changedCards) {
      if (card) {
        await ops.save(card.data.type, card.data.id, card);
      }
    }
  }
}