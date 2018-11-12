import { helper } from '@ember/component/helper';

export function csHasErrors([errors, model, options]) {
  if (!errors) {
    return false;
  }
  let { name: fieldName, grouped } = options;
  let fields = grouped ? grouped : [fieldName];
  return hasErrorForAnyField(errors, model, fields);
}

export default helper(csHasErrors);

function hasErrorForAnyField(errors, model, fields) {
  return fields.some(field => errors[field] && errors[field].length > 0);
}
