import DS from 'ember-data';

export default DS.JSONAPIAdapter.extend({
  host: 'http://localhost:3000',

  findRecord(store, type, id /*, snapshot */) {
    let [branch, realType, realId] = id.split('/');
    let adapter = store.adapterFor(realType);
    return adapter.queryRecord(store, store.modelFor(realType), {
      id: realId,
      branch,
      isGeneric: true
    }).then(response => {
      return {
        data: {
          id,
          type: type.modelName,
          attributes: {
            'real-id': realId,
            'real-type': realType,
            attributes: response.data.attributes,
            realtionships: response.data.relationships
          }
        }
      }
    });
  },

});
