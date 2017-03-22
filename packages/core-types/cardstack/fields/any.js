module.exports = {
  valid(/* value */) {
    return true;
  },
  defaultMapping() {
    return {
      type: 'object',
      enabled: false
    };
  }
};
