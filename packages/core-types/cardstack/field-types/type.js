module.exports = {
  valid(value) {
    return typeof value === 'string';
  },
  defaultMapping() {
    return {
      type: "keyword",
      index: false
    };
  }
};
