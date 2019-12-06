module.exports = {
  valid(value) {
    return typeof value === 'string';
  },

  buildQueryExpression(sourceExpression, name) {
    return ['lower(', ...sourceExpression, '->>', { param: name }, ')'];
  },

  buildValueExpression(valueExpression) {
    return ['lower(', ...valueExpression, ')'];
  },
};
