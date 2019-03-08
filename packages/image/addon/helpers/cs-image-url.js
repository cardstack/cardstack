import { helper } from '@ember/component/helper';
import { hubURL } from "@cardstack/plugin-utils/environment";

export function csImageUrl(imageOrFile) {
  let id;
  if (imageOrFile.constructor.modelName === 'cardstack-file') {
    id = imageOrFile.get('id');
  } else {
    id = imageOrFile.belongsTo('file').id()
  }
  return `${hubURL}/api/cardstack-files/${id}`;
}

export default helper(function([imageOrFile]) {
  return csImageUrl(imageOrFile);
});
