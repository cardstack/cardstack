export function isEmpty(value) {
  return !value || !value.sections || !value.sections.find(section => section[1] === 'p' && section[2].length > 0);
}

export function placeholder(humanizedFieldName) {
  let message = `Enter ${humanizedFieldName} here...`;
  return {"version":"0.3.1","atoms":[],"cards":[],"markups":[],"sections":[[1,"p",[[0,[],0,message]]]]};
}
