import { helper } from '@ember/component/helper';
import { fieldType } from '@cardstack/rendering/helpers/cs-field-type';
// @TODO: expose public api
import metaForField from '@cardstack/rendering/-private/meta-for-field';

export function csFieldEditorOptionsFor([content, fieldName], { variant }) {
  let type = fieldType(content, fieldName);
  let options = fieldOptions(content, fieldName);

  if (options.editorOptions && !variant) {
    return options.editorOptions;
  }
  else if (options.inlineEditorOptions && variant == 'inline') {
    return options.inlineEditorOptions
  }

  if (!type) {
    return;
  }

  return {};
}

export default helper(csFieldEditorOptionsFor);

function fieldOptions(content, fieldName) {
  let meta = metaForField(content, fieldName);
  return (meta && meta.options) ? meta.options : {}
}
