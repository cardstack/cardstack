module.exports = {
  valid(value) {
    return typeof value === 'boolean';
  },
  defaultMapping() {
    return {
      type: "boolean"
    };
  }
};
