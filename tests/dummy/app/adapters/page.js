import DS from 'ember-data';

export default DS.JSONAPIAdapter.extend({
  findRecord(store, type, id /* , snapshot */) {
    return {
      data: {
        id,
        type: type.modelName,
        attributes: {
          title: "hello world"
        }
      }
    }
  }
});
