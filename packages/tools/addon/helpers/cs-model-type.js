import Ember from 'ember';

export function csModelType([model]) {
  if (model) {
    return model.constructor.modelName;
  }
}

export default Ember.Helper.helper(csModelType);
