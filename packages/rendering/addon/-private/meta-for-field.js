import { camelize } from "@ember/string";

export default function metaForField(content, fieldName) {
  if (!content) { return; }

  fieldName = camelize(fieldName);
  try {
    return content.constructor.metaForProperty(fieldName);
  } catch (err) {
    return;
  }

}

