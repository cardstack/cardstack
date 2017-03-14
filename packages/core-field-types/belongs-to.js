module.exports = {
  valid(/* value */) {
    return true;
  },
  defaultMapping() {
    return {
      type: "nested"
    };
  }
};
