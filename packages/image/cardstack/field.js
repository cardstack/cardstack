module.exports = {
  valid(/* value */) {
    return true;
  },

  // disable indexing
  defaultMapping() {
    return {
      type: 'object',
      enabled: false
    };
  },
};
