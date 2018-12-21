module.exports = {
  valid(value) {
    return typeof value==='number';
  },
  buildQueryExpression(sourceExpression, name){
    return ['(', ...sourceExpression, '->>', { param: name }, ')::real'];
  }
};
