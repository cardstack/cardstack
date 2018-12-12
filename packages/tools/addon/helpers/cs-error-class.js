import { helper } from '@ember/component/helper';

export function csErrorClass([errors, model, errorClass]) {
  if (!errors) {
    return "";
  }
  let fieldNames = model.grouped ? model.grouped : [ model.name ];
  let hasErrors = hasErrorForAnyField(errors, fieldNames);
  return hasErrors ? errorClass : "";
}

export default helper(csErrorClass);

function hasErrorForAnyField(errors, fields) {
  return fields.some(field => errors[field] && errors[field].length > 0);
}
