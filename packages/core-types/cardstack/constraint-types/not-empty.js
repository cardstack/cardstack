const Handlebars = require('handlebars');

Handlebars.registerHelper('capitalize', function(str) {
  if (!str) {
    return '';
  }
  return str.split(/-/)
    .map((word) => word.replace(/^(\w)/, (m, d) => d.toUpperCase()));
});

module.exports = {
  inputs: {
    ignoreBlank: ['@cardstack/core-types::boolean']
  },
  description: `{{capitalize target.name}} must not be empty`,
  valid({ target, ignoreBlank }) {
    let value = target.value;
    if (value == null) {
      return false;
    }
    if (ignoreBlank.value) {
      value = value.trim();
    }
    return value.length > 0;
  }
};
