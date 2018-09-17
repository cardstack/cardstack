import Service, { inject as service } from '@ember/service';

export default Service.extend({
  cardstackEdges: service(),
  init() {
    this._super();

    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('card-picker-edges');
  },
});
