export function isEmpty(value) {
  return !value || value.isPlaceholder;
}

export function placeholder(/* humanizedFieldName */) {
  return {isPlaceholder: true};
}
