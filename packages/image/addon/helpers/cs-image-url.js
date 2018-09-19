import { helper } from '@ember/component/helper';
import { hubURL } from "@cardstack/plugin-utils/environment";
import { pluralize } from 'ember-inflector';

export function csImageUrl([file]) {
  let modelName = pluralize(file.constructor.modelName)
  return `${hubURL}/api/${modelName}/${file.get('id')}`;
}

export default helper(csImageUrl);
