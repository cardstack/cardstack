import Service, { inject as service } from '@ember/service';

export default Service.extend({
  cardstackEdges: service(),
  init() {
    this._super();

    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('card-picker-edges');
  },

  pickCard() {
    return new Promise((resolve, reject) => {
      this.setProperties({ resolve, reject });
      this.set('active', true);
    });
  },

  resolveCard(model) {
    this.get('resolve')(model);
    this.set('active', false);
  },
});
