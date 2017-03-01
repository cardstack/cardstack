module.exports = {
  valid(value) {
    return value == null || typeof value === 'string';
  }
};
