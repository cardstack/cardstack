import { camelize } from '@ember/string';
import Ember from 'ember';

export function fieldType(content, fieldName) {
  if (!content) { return; }
  let meta;

  fieldName = camelize(fieldName);

  try {
    meta = content.constructor.metaForProperty(fieldName);
  } catch (err) {
    return;
  }

  // meta.options.fieldType is our convention for annotating
  // models. meta.type is the name of the transform that ember-data
  // is using, which we keep as a fallback.
  let type = meta.options && meta.options.fieldType;

  if (!type && meta.type) {
    // lift the default ember-data transform names into our core
    // types
    type = `@cardstack/core-types::${meta.type}`;
  }

  if (type) {
    type = stripNamespace(type);
  }
  return type;
}

function stripNamespace(type) {
  // Right now the actual field editor components get flattened down
  // out of their namespaces, so we throw away everything but the
  // last bit of their names here. This problem is easier to solve
  // once I can integrate a module-unification resolver, so I'm
  // leaving it like this for now.
  let parts = type.split(/[/:]/g);
  return parts[parts.length - 1];
}

export default Ember.Helper.helper(fieldType);
