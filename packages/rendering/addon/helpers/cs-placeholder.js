import Ember from 'ember';

export default Ember.Helper.helper(function(params, options={}) {
  let { fieldConfig, fieldCaption, value, active } = options;

  if (!active) {
    return value;
  }

  let isEmpty = !value;
  if (fieldConfig && fieldConfig.isEmpty) {
    isEmpty = fieldConfig.isEmpty(value);
  }
  if (isEmpty) {
    if (fieldConfig && fieldConfig.placeholder) {
      return fieldConfig.placeholder(fieldCaption);
    } else {
      return `Enter ${fieldCaption}`;
    }
  } else {
    return value;
  }
});
