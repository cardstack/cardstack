import Ember from 'ember';
import { humanize } from './cs-humanize';

export default Ember.Helper.helper(function(params, options={}) {
  let { fieldConfig, fieldCaption, value, active, fieldName } = options;

  if (!active) {
    return value;
  }

  let isEmpty = !value;
  if (fieldConfig && fieldConfig.isEmpty) {
    isEmpty = fieldConfig.isEmpty(value);
  }
  if (isEmpty) {
    if (fieldConfig && fieldConfig.placeholder) {
      return fieldConfig.placeholder(humanize(fieldName));
    } else {
      return `Enter ${fieldCaption}`;
    }
  } else {
    return value;
  }
});
