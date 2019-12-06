module.exports = {
  inputs: {
    ignoreBlank: ['@cardstack/core-types::boolean'],
  },
  description: `{{target.name}} must not be empty`,
  valid({ target, ignoreBlank }) {
    let value = target.value;
    if (value == null) {
      return false;
    }
    if (ignoreBlank.value) {
      value = value.trim();
    }
    return value.length > 0;
  },
};
