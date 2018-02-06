import { helper } from '@ember/component/helper';
import metaForField from '../-private/meta-for-field';
import stripNamespace from '../-private/strip-namespace';

export default helper(function([content, fieldName]) {
  return fieldCaption(content, fieldName);
});

export function fieldCaption(content, fieldName) {
  let meta = metaForField(content, fieldName);
  if (!meta) {
    return;
  }
  
  let caption = meta.options && meta.options.caption;
  if (caption) {
    caption = stripNamespace(caption);
  }

  return caption;
}
