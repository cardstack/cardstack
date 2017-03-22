module.exports = {
  valid(value) {
    return typeof value === 'object';
  },
  defaultMapping() {
    return {
      type: "object"
    };
  }
};
