import { helper as buildHelper } from '@ember/component/helper';

let defaults = ['title', 'name'];

export function csModelTitle([model]) {
  if (model) {
    for (let d of defaults) {
      let value = model.get(d);
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return 'Untitled';
  }
}

export default buildHelper(csModelTitle);
