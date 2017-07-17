export function isEmpty(value) {
  let hasImage = value && (value.base64);
  return !hasImage;
}

export function placeholder(/* humanizedFieldName */) {
  return {};
}
