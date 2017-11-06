import { helper } from '@ember/component/helper';
import { fieldType } from '@cardstack/rendering/helpers/cs-field-type';
// @TODO: expose public api
import metaForField from '@cardstack/rendering/-private/meta-for-field';

export function csFieldEditorFor([content, fieldName], { variant }) {
  let type = fieldType(content, fieldName);
  let options = fieldOptions(content, fieldName);
  
  if (options.editor && !variant) {
    return options.editor;
  }
  else if (options.inlineEditor && variant == 'inline') {
    return options.inlineEditor
  }

  if (!type) {
    return;
  }

  let prefix = '';
  if (variant === 'inline') {
    prefix = 'inline-';
  }
  return `${prefix}field-editors/${type}-editor`;
}

export default helper(csFieldEditorFor);

function fieldOptions(content, fieldName) {
  let meta = metaForField(content, fieldName);
  return (meta && meta.options) ? meta.options : {}
}