export default function metaForField(content, fieldName) {
  if (!content) { return; }

  try {
    return content.constructor.metaForProperty(fieldName);
  } catch (err) {
    return;
  }

}

