import { helper } from '@ember/component/helper';

export function csHasErrors([fieldModel]) {
  let { grouped, content } = fieldModel;
  if (content.isValid) {
    return false;
  }
  let fields = grouped ? grouped : [fieldModel.name];
  return hasErrorForAnyField(content, fields);
}

export default helper(csHasErrors);

function hasErrorForAnyField(model, fields) {
  return fields.some(field => model.get('errors').has(field));
}
