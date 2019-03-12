import Service, { inject as service } from '@ember/service';

export default Service.extend({
  cardstackEdges: service(),
  init() {
    this._super();

    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('card-picker-edges');
  },

  pickCard(type, opts={}) {
    let { sort, searchFields, searchType } = opts;
    this.set('requestedType', type);
    this.set('initialSort', sort);
    this.set('searchType', searchType);
    this.set('searchFields', searchFields);

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
    this.get('reject')('no card selected');
    this.set('active', false);
  }
});
