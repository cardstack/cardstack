import DS from 'ember-data';

export default DS.JSONAPIAdapter.extend({
  host: 'http://localhost:3000',

  findRecord(store, type, id, snapshot) {
    let [branch, realType, realId] = id.split('/');
    let adapter = store.adapterFor(realType);
    return adapter.query(store, store.modelFor(realType), { id: realId, branch }).then(response => {
      debugger;
    });
  },

});
