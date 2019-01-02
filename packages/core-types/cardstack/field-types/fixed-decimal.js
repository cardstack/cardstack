module.exports = {
  valid(value) {
    return typeof parseFloat(value) === 'number';
  },
  buildQueryExpression(sourceExpression, name){
    return ['(', ...sourceExpression, '->>', { param: name }, ')::numeric'];
  }
};
