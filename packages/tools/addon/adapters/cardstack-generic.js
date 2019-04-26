import AdapterMixin from 'ember-resource-metadata/adapter-mixin';
import DS from 'ember-data';

export default DS.JSONAPIAdapter.extend({
  findRecord(store, type, id /*, snapshot */) {
    let [realType, realId] = id.split('/');
    let adapter = store.adapterFor(realType);
    return adapter.queryRecord(store, store.modelFor(realType), {
      filter: { id: realId },
      disableResourceMetadata: true
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
          },
          meta: response.data.meta
        }
      }
    });
  }
}, AdapterMixin);
