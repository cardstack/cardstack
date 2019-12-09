import { helper as buildHelper } from '@ember/component/helper';
import { get } from '@ember/object';

export function modelType(model) {
  if (model) {
    return get(model, 'type') || model.constructor.modelName;
  }
}

export default buildHelper(function([model]) {
  return modelType(model);
});
