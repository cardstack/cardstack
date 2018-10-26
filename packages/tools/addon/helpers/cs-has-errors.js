import { helper } from '@ember/component/helper';

export function csHasErrors([errors, fieldModel]) {
  if (!errors) { return false; }
  let { grouped, content } = fieldModel;
  let fields = grouped ? grouped : [fieldModel.name];
  return hasErrorForAnyField(errors, content, fields);
}

export default helper(csHasErrors);

function hasErrorForAnyField(errors, model, fields) {
  return fields.some(field => errors[field] && errors[field].length > 0);
}
