import Service, { inject as service } from '@ember/service';

export default Service.extend({
  cardstackEdges: service(),
  init() {
    this._super();

    console.log('Register FACE');
    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('card-picker-edges');
  },

  pickCard() {
    console.log('FACE');
    return new Promise((resolve, reject) => {
      this.setProperties({ resolve, reject });
      this.set('active', true);
    });
  },

  resolveCard(model) {
    this.get('resolve')(model);
    this.set('active', false);
  },

  closePicker() {
    this.get('reject')();
    this.set('active', false);
  }
});
