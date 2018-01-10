import { helper } from '@ember/component/helper';
import metaForField from '../-private/meta-for-field';
import stripNamespace from '../-private/strip-namespace';
import { humanize } from  './cs-humanize';

export default helper(function([content, fieldName]) {
  return fieldCaption(content, fieldName);
});

export function fieldCaption(content, fieldName) {
  let meta = metaForField(content, fieldName);
  let caption;
  if (meta) {
    caption = meta.options && meta.options.caption;
    if (caption) {
      caption = stripNamespace(caption);
    }
  }
  return caption || humanize(fieldName);
}
