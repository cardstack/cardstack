

module.exports = {
  valid(value) {
    return typeof value === 'object' && value.hasOwnProperty('version');
  },
};
