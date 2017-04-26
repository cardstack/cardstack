import Ember from 'ember';

export function modelType(model) {
  if (model) {
    return Ember.get(model, 'type') || model.constructor.modelName;
  }
}

export default Ember.Helper.helper(function([model]){
  return modelType(model);
});
