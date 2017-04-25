import Ember from 'ember';

export function modelType([model]) {
  if (model) {
    return model.get('type') || model.constructor.modelName;
  }
}

export default Ember.Helper.helper(modelType);
