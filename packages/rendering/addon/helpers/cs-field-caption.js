import Ember from 'ember';
import metaForField from '../-private/meta-for-field';
import stripNamespace from '../-private/strip-namespace';

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

export default Ember.Helper.helper(fieldCaption);
